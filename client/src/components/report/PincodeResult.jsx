import { MapPinIcon } from "lucide-react";
import { WaitlistForm } from "@/components/report/WaitlistForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { t } from "@/i18n/t";

const PREVIEW = 4;

/** What the lookup found: the place, a waitlist, or an error with "Try again". */
export function PincodeResult({ pin, lookup }) {
  const showSkeleton = useDelayedFlag(lookup.isFetching && !lookup.data);
  if (lookup.isPending) {
    return showSkeleton ? <Skeleton className="h-16 w-full" /> : null;
  }

  const unknown = lookup.error?.code === "PINCODE_NOT_FOUND";
  if (lookup.error && !unknown) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm">{lookup.error.message}</p>
        <Button variant="outline" onClick={() => lookup.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (unknown || !lookup.data.served) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <p className="text-base">
          {t(unknown ? "report.pincode.unknown" : "report.pincode.notServed", { pincode: pin })}
        </p>
        <WaitlistForm pin={pin} />
      </div>
    );
  }

  const { cityName, district, state, localities } = lookup.data;
  const more = localities.length - PREVIEW;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <MapPinIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">
          {t("report.pincode.place", { city: cityName ?? district, state })}
        </p>
        {localities.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {more > 0
              ? t("report.pincode.localitiesMore", {
                  list: localities.slice(0, PREVIEW).join(", "),
                  count: more,
                })
              : t("report.pincode.localities", { list: localities.join(", ") })}
          </p>
        )}
      </div>
    </div>
  );
}
