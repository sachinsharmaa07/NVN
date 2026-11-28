import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { DepartmentDialog } from "@/components/admin/DepartmentDialog";
import { ErrorState } from "@/components/system/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateDepartment, useRenameDepartment } from "@/hooks/useDepartmentAdmin";
import { useDepartments } from "@/hooks/useDepartments";
import { t } from "@/i18n/t";
import { durations, easings } from "@/lib/motion";
import { plural } from "@/lib/plural";

// A department that was just added fades in `fast`; the ones already there don't animate.
const ARRIVE = { duration: durations.fast, ease: easings.enter };

/**
 * The city's departments under the category table: name and code, "Rename" per row, "Add department".
 * `sendCityId`: a super admin names the city in the request; a city admin always writes in their own.
 */
export function DepartmentsSection({ cityId, sendCityId }) {
  const query = useDepartments(cityId);
  const create = useCreateDepartment(cityId, { sendCityId });
  const rename = useRenameDepartment(cityId);
  // { mode: "add" } or { mode: "rename", department }; seq makes every opening a fresh form.
  const [dialog, setDialog] = useState(null);
  const departments = query.data ?? [];

  return (
    <section aria-labelledby="departments-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="departments-title" className="font-display text-h3 font-semibold">
            {t("admin.department.sectionTitle")}
          </h2>
          {query.data && (
            <p className="text-sm text-muted-foreground">
              {plural(departments.length, "admin.department.count")}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => setDialog({ mode: "add", seq: Date.now() })}>
          <PlusIcon aria-hidden="true" />
          {t("admin.department.add")}
        </Button>
      </div>
      {query.isPending && <Skeleton aria-hidden="true" className="h-32 w-full" />}
      {query.isError && (
        <ErrorState
          variant="inline"
          title={t("admin.department.error")}
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && (
        <ul className="divide-y rounded-lg border">
          <AnimatePresence initial={false}>
            {departments.map((d) => (
              <m.li
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={ARRIVE}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{d.code}</span>
                </span>
                <Button
                  variant="ghost"
                  aria-label={t("admin.department.renameLabel", { name: d.name })}
                  onClick={() => setDialog({ mode: "rename", department: d, seq: Date.now() })}
                >
                  {t("admin.department.rename")}
                </Button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {dialog && (
        <DepartmentDialog
          key={dialog.seq}
          department={dialog.department}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mutation={dialog.mode === "add" ? create : rename}
        />
      )}
    </section>
  );
}
