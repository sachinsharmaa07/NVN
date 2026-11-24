import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline error under a field when you are not using the shadcn Form (FormMessage looks the same).
 * Give it an `id` and point the input's aria-describedby at it, and set aria-invalid on the input:
 *   <Input aria-invalid aria-describedby="pin-error" /> <FieldError id="pin-error">...</FieldError>
 * Renders nothing when there is no message.
 */
export function FieldError({ id, children, className }) {
  if (!children) return null;
  return (
    <p
      id={id}
      data-slot="field-error"
      className={cn("flex items-start gap-2 text-sm text-destructive", className)}
    >
      {/* h-5 = one text-sm line, so the icon centres on the first line of a long message. */}
      <span className="flex h-5 shrink-0 items-center">
        <CircleAlert aria-hidden="true" className="size-4" />
      </span>
      <span>{children}</span>
    </p>
  );
}
