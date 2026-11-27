import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/system/FieldError";
import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePost } from "@/hooks/useCommunity";
import { t } from "@/i18n/t";

// Mirrors the server's strict POST /api/community/posts body.
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(5, t("community.composer.titleError"))
    .max(100, t("community.composer.titleError")),
  body: z.string().trim().min(10, t("community.composer.bodyError")).max(2000),
});

const SERVER_COPY = {
  RATE_LIMITED: "community.composer.limit",
  PINCODE_NOT_SERVED: "community.composer.notServed",
  PINCODE_REQUIRED: "community.composer.needPincode",
};

/** "Write a post" as a Dialog on desktop and a bottom Drawer on phones (UI.md §6). Pessimistic. */
export function PostComposer({ pincode, open, onOpenChange }) {
  const create = useCreatePost();
  const [formError, setFormError] = useState("");
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "" },
    mode: "onBlur",
  });
  const bodyLength = useWatch({ control: form.control, name: "body" }).length;

  async function onSubmit(values) {
    setFormError("");
    try {
      await create.mutateAsync(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(t(SERVER_COPY[error.code] ?? "errors.common.network"));
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !create.isPending && onOpenChange(next)}
      title={t("community.composer.title", { pincode })}
      description={t("community.composer.description")}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4 pb-4 lg:pb-0"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("community.composer.titleLabel")}</FormLabel>
                <FormControl>
                  <Input maxLength={100} autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{t("community.composer.titleHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("community.composer.bodyLabel")}</FormLabel>
                <FormControl>
                  <Textarea rows={6} maxLength={2000} {...field} />
                </FormControl>
                <FormDescription className="tabular-nums">
                  {t("community.composer.bodyHint", { count: bodyLength })}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {formError && (
            <div role="alert">
              <FieldError>{formError}</FieldError>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={create.isPending}>
              {create.isPending
                ? t("community.composer.submitting")
                : t("community.composer.submit")}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
