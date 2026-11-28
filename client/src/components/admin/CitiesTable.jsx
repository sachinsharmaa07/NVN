import { LedgerTable } from "@/components/system/LedgerTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

const statusLabel = (city) =>
  t(city.status === "active" ? "admin.cities.active" : "admin.cities.paused");
const actionLabel = (city) =>
  t(city.status === "active" ? "admin.cities.pause" : "admin.cities.open");

/**
 * Cities as a ledger (02-lld §2): City (name, code under it), State, Status (outline badge), and the one
 * action, "Pause city" or "Open city", which `onToggle(city, button)` turns into a confirm dialog.
 * Below 1024px, one card per city with the same facts and the same button.
 */
export function CitiesTable({ cities, onToggle, ...ledger }) {
  const columns = [
    {
      key: "city",
      header: t("admin.cities.colCity"),
      cell: (city) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{city.name}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{city.code}</span>
        </span>
      ),
    },
    { key: "state", header: t("admin.cities.colState"), cell: (city) => city.stateCode },
    {
      key: "status",
      header: t("admin.cities.colStatus"),
      cell: (city) => <Badge variant="outline">{statusLabel(city)}</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("admin.cities.colActions")}</span>,
      align: "right",
      cell: (city) => (
        <Button variant="outline" onClick={(e) => onToggle(city, e.currentTarget)}>
          {actionLabel(city)}
        </Button>
      ),
    },
  ];

  return (
    <LedgerTable
      columns={columns}
      rows={cities}
      getRowKey={(city) => city.id}
      caption={t("admin.cities.caption")}
      renderCard={(city) => (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{city.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {city.code}, {city.stateCode}
              </span>
            </span>
            <Badge variant="outline">{statusLabel(city)}</Badge>
          </div>
          <Button
            variant="outline"
            className="self-start"
            onClick={(e) => onToggle(city, e.currentTarget)}
          >
            {actionLabel(city)}
          </Button>
        </div>
      )}
      {...ledger}
    />
  );
}
