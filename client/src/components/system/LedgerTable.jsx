import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ErrorState } from "@/components/system/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/i18n/t";
import { durations, easings, springs, useMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Motion versions of the row and the list item, so a row that leaves fades and the rest close the gap.
const MotionRow = m.create(TableRow);
const LEAVE = { opacity: 0, transition: { duration: durations.fast, ease: easings.exit } };
const SKELETON_ROWS = 5;

/**
 * A dense work list (02-lld §2, UI.md §5.1 "ledger"): a table from 1024px, one card per row below.
 * - columns: [{ key, header, cell(row), align: "left" | "right", className }]; the first cell holds the
 *   row's only focusable element (the button that opens it).
 * - busy: a refetch with old rows still on screen (filters keep previous data); they dim, no skeleton.
 * - States: skeleton rows on a first load (after 200ms), an inline ErrorState, `empty`, "Load more".
 * A row that leaves (e.g. no longer matches the filter) fades out `fast`; the others slide up.
 */
export function LedgerTable({
  columns,
  rows,
  getRowKey,
  renderCard,
  caption,
  countLabel,
  selectedKey,
  busy = false,
  isLoading = false,
  isError = false,
  onRetry,
  errorTitle,
  empty,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const showSkeleton = useDelayedFlag(isLoading);
  const slide = useMotionSafe(springs.snappy);

  if (isLoading) {
    return showSkeleton ? <SkeletonRows columns={columns} desktop={desktop} /> : null;
  }
  if (isError) return <ErrorState variant="inline" title={errorTitle} onRetry={onRetry} />;
  if (rows.length === 0) return empty;

  const motionProps = { layout: true, transition: { layout: slide }, exit: LEAVE };

  return (
    <div className="fade-in flex flex-col gap-4">
      {countLabel && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {countLabel}
        </p>
      )}
      <div
        aria-busy={busy || undefined}
        className={cn("transition-opacity duration-base ease-standard", busy && "opacity-60")}
      >
        {desktop ? (
          <Table>
            {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className={cn(col.align === "right" && "text-right")}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout" initial={false}>
                {rows.map((row) => {
                  const key = getRowKey(row);
                  return (
                    <MotionRow
                      key={key}
                      {...motionProps}
                      data-state={key === selectedKey ? "selected" : undefined}
                      className="hover:bg-muted/60 data-[state=selected]:bg-accent"
                    >
                      {columns.map((col, i) => {
                        const Cell = i === 0 ? TableHead : TableCell;
                        return (
                          <Cell
                            key={col.key}
                            scope={i === 0 ? "row" : undefined}
                            className={cn(
                              "py-3 align-top",
                              i === 0 && "font-normal",
                              col.align === "right" && "text-right",
                              col.className,
                            )}
                          >
                            {col.cell(row)}
                          </Cell>
                        );
                      })}
                    </MotionRow>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        ) : (
          <ul className="grid gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((row) => {
                const key = getRowKey(row);
                return (
                  <m.li key={key} {...motionProps}>
                    {renderCard(row, key === selectedKey)}
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} loading={loadingMore}>
            {t("system.ledger.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

// First load only: rows shaped like the real ones, so nothing jumps when they arrive.
function SkeletonRows({ columns, desktop }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_ROWS }, (_, i) =>
        desktop ? (
          <div key={i} className="flex gap-4 border-b py-3">
            {columns.map((col) => (
              <Skeleton key={col.key} className="h-10 flex-1" />
            ))}
          </div>
        ) : (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ),
      )}
    </div>
  );
}
