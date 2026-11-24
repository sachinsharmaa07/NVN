import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";

const SIZES = {
  md: "text-xl",
  lg: "text-2xl sm:text-3xl md:text-4xl",
};

/**
 * A ticket ID such as NIV-2026-000123, always in full (UI.md §8), in the display font with
 * tabular figures so the digits line up like a stamped counterfoil. Not monospace (UI.md §1).
 * The copy button is a 44px target with a translated aria-label; success and failure both toast.
 */
export function TicketId({ id, size = "md", copyable = true, className }) {
  const [copied, setCopied] = useState(false);

  // Swap the icon back to "copy" two seconds after a successful copy.
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      // navigator.clipboard is missing on plain http and in some in-app browsers.
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success(t("system.ticket.copied"));
    } catch {
      toast.error(t("system.ticket.copyFailed"));
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <span
      data-slot="ticket-id"
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      <span
        className={cn(
          // nowrap: an ID never breaks at its hyphens; on a narrow screen the button wraps instead.
          "font-display font-bold tracking-wide whitespace-nowrap text-foreground tabular-nums",
          SIZES[size] ?? SIZES.md,
        )}
      >
        {id}
      </span>
      {copyable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={copy}
          aria-label={t("system.ticket.copy", { id })}
          className="text-muted-foreground hover:text-accent-foreground"
        >
          <Icon aria-hidden="true" />
        </Button>
      )}
    </span>
  );
}
