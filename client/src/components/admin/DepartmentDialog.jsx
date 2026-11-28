import { useId, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/system/FieldError";
import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n/t";

// The server's rules (server/src/validators/departmentAdmin.js), checked here first.
const CODE = /^[A-Z0-9_]{2,20}$/;

/**
 * Add a department (name + code) or rename one (`department` given: name only, the code is shown but
 * can't change). The code is upper-cased when the field loses focus. A 409 means the code is taken in
 * this city, shown on the code field. `mutation` is useCreateDepartment or useRenameDepartment.
 */
export function DepartmentDialog({ department, open, onOpenChange, mutation }) {
  const id = useId();
  const renaming = Boolean(department);
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [problems, setProblems] = useState({});
  const [formError, setFormError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    const upper = code.trim().toUpperCase();
    const found = {
      name:
        name.trim().length < 2 || name.trim().length > 100 ? t("admin.department.nameError") : "",
      code: renaming || CODE.test(upper) ? "" : t("admin.department.codeError"),
    };
    setProblems(found);
    if (found.name || found.code) return;
    try {
      await mutation.mutateAsync(
        renaming ? { id: department.id, name: name.trim() } : { name: name.trim(), code: upper },
      );
      toast.success(t(renaming ? "admin.department.renamed" : "admin.department.added"));
      onOpenChange(false);
    } catch (error) {
      if (error.status === 409) setProblems({ code: t("admin.department.codeTaken") });
      else setFormError(error.message);
    }
  }

  const describe = (key) => (problems[key] ? `${id}-${key}-error` : undefined);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
      title={t(renaming ? "admin.department.renameTitle" : "admin.department.addTitle")}
      description={t(renaming ? "admin.department.renameBody" : "admin.department.addBody")}
      footer={
        <>
          <Button type="submit" form={`${id}-form`} loading={mutation.isPending}>
            {t(renaming ? "admin.department.renameSubmit" : "admin.department.addSubmit")}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>{t("admin.department.name")}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(problems.name) || undefined}
            aria-describedby={describe("name")}
          />
          <FieldError id={`${id}-name-error`}>{problems.name}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-code`}>{t("admin.department.code")}</Label>
          <Input
            id={`${id}-code`}
            value={code}
            maxLength={20}
            readOnly={renaming}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => setCode((c) => c.trim().toUpperCase())}
            aria-invalid={Boolean(problems.code) || undefined}
            aria-describedby={`${id}-code-hint ${describe("code") ?? ""}`.trim()}
            className="tabular-nums read-only:bg-muted"
          />
          <p id={`${id}-code-hint`} className="text-sm text-muted-foreground">
            {t(renaming ? "admin.department.codeFixed" : "admin.department.codeHint")}
          </p>
          <FieldError id={`${id}-code-error`}>{problems.code}</FieldError>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  );
}
