import { LedgerTable } from "@/components/system/LedgerTable";
import { CircleCheckIcon, ClockIcon } from "lucide-react";
import { StateBadge } from "@/components/system/StateBadge";
import { t } from "@/i18n/t";
import { formatDate } from "@/lib/format";
import { plural } from "@/lib/plural";

const area = (row) => [row.district, row.state].filter(Boolean).join(", ") || "–";
const Served = ({ row }) => (
  <StateBadge
    tone={row.isServed ? "good" : "neutral"}
    icon={row.isServed ? CircleCheckIcon : ClockIcon}
  >
    {served(row)}
  </StateBadge>
);
const served = (row) => t(row.isServed ? "admin.waitlist.served" : "admin.waitlist.notServed");

/**
 * The waitlist as a ledger (02-lld §2): Pincode, Area, Sign-ups (right), Latest (right), Served (badge),
 * in the server's order (most sign-ups first). A top-N report, so no "Load more". Cards below 1024px.
 */
export function WaitlistTable({ rows, ...ledger }) {
  const columns = [
    {
      key: "pin",
      header: t("admin.waitlist.colPincode"),
      cell: (row) => <span className="font-medium tabular-nums">{row.pin}</span>,
    },
    { key: "area", header: t("admin.waitlist.colArea"), cell: area },
    {
      key: "count",
      header: t("admin.waitlist.colCount"),
      align: "right",
      className: "tabular-nums",
      cell: (row) => new Intl.NumberFormat("en-IN").format(row.count),
    },
    {
      key: "latest",
      header: t("admin.waitlist.colLatest"),
      align: "right",
      className: "tabular-nums",
      cell: (row) => formatDate(row.latestAt),
    },
    {
      key: "served",
      header: t("admin.waitlist.colServed"),
      cell: (row) => <Served row={row} />,
    },
  ];

  return (
    <LedgerTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.pin}
      caption={t("admin.waitlist.caption")}
      renderCard={(row) => (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-h3 font-semibold tabular-nums">{row.pin}</span>
            <Served row={row} />
          </div>
          <span className="text-muted-foreground">{area(row)}</span>
          <span className="text-sm tabular-nums">
            {plural(row.count, "admin.waitlist.cardCount", {
              count: new Intl.NumberFormat("en-IN").format(row.count),
            })}
            {", "}
            {t("admin.waitlist.cardLatest", { date: formatDate(row.latestAt) })}
          </span>
        </div>
      )}
      {...ledger}
    />
  );
}
