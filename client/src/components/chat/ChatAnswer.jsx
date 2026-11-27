import { Link } from "react-router";
import { StatusBadge } from "@/components/system/StatusBadge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";

const CLOSED = ["resolved", "closed", "rejected"];

/** A ticket answered from the database: badge, title, department and the date it is due. */
function TicketCard({ ticket, linkable }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <span className="font-display text-sm tracking-wide tabular-nums">{ticket.ticketId}</span>
      </div>
      <p className="font-medium">{ticket.title}</p>
      <p className="text-sm text-muted-foreground">
        {ticket.department ? t("chat.department", { name: ticket.department }) : t("chat.triage")}
      </p>
      {!CLOSED.includes(ticket.status) && (
        <p className="text-sm text-muted-foreground">
          {t("chat.expectedBy", { date: formatDateTime(ticket.expectedBy) })}
        </p>
      )}
      {linkable && (
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <Link to={`/issues/${ticket.ticketId}`}>{t("chat.openTicket")}</Link>
        </Button>
      )}
    </li>
  );
}

/** Renders one answer from POST /api/chat by its `kind`; the wording is ours, never the server's. */
export function ChatAnswer({ answer }) {
  if (answer.error) return <p>{t(answer.error)}</p>;
  if (answer.kind === "general") {
    return (
      <div className="flex flex-col gap-2">
        <p className="whitespace-pre-line">{answer.reply}</p>
        <p className="text-sm text-muted-foreground">{t("chat.generalNote")}</p>
      </div>
    );
  }
  if (answer.kind === "fallback") return <p>{t("chat.fallback")}</p>;

  const mine = answer.kind === "list";
  return (
    <div className="flex flex-col gap-2">
      {answer.tickets.length > 0 && (
        <>
          <p>{t(mine ? "chat.listIntro" : "chat.ticketsFound")}</p>
          <ul className="flex flex-col gap-2">
            {answer.tickets.map((ticket) => (
              <TicketCard key={ticket.ticketId} ticket={ticket} linkable={mine} />
            ))}
          </ul>
        </>
      )}
      {mine && answer.tickets.length === 0 && <p>{t("chat.listEmpty")}</p>}
      {answer.unknown?.length > 0 && <p>{t("chat.unknown", { ids: answer.unknown.join(", ") })}</p>}
    </div>
  );
}
