import { useMutation } from "@tanstack/react-query";
import { LocateFixedIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/useApi";
import { useLookupPincode } from "@/hooks/useLookupPincode";
import { t } from "@/i18n/t";
import { insideArea } from "@/lib/geo";

// Leaflet (about 40 KB gzip plus CSS) only downloads when someone reaches this step.
const PinMap = lazy(() => import("@/components/report/PinMap"));

/**
 * Where the pin starts: the saved one if still inside, else nowhere. No default at the centre: a
 * resident who just presses Next would file the issue at the wrong spot.
 */
const startPoint = (area, saved) => (saved && insideArea(area, saved) ? saved : null);

/**
 * Report step 2. The pin can only sit inside the pincode; a refused move snaps back and is announced.
 * Next asks the server (check-point) too, so the polygon rule is the server's, not only ours.
 * `notice`: a message to show on arrival (the submit came back 422 OUTSIDE_PINCODE).
 */
export function MapStep({ pincode, saved, notice, onBack, onNext }) {
  const lookup = useLookupPincode(pincode);
  if (lookup.isPending) return <Skeleton className="h-80 w-full sm:h-96" />;
  if (lookup.error || !lookup.data?.served) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm">{lookup.error?.message ?? t("report.location.notServed")}</p>
        <Button variant="outline" onClick={onBack}>
          {t("report.wizard.back")}
        </Button>
      </div>
    );
  }
  return (
    <PinPicker
      area={lookup.data}
      pincode={pincode}
      saved={saved}
      notice={notice}
      onBack={onBack}
      onNext={onNext}
    />
  );
}

function PinPicker({ area, pincode, saved, notice, onBack, onNext }) {
  const api = useApi();
  const [pin, setPin] = useState(() => startPoint(area, saved));
  const [message, setMessage] = useState(notice ?? "");
  const outside = () => setMessage(t("report.location.outsidePincode", { pincode }));

  const check = useMutation({
    mutationFn: ([lng, lat]) =>
      api(`/api/pincodes/${pincode}/check-point`, { method: "POST", body: { lat, lng } }),
    onSuccess: (res, [lng, lat]) =>
      res.inside ? onNext({ lat, lng, precision: res.precision }) : outside(),
    onError: (err) => setMessage(err.message),
  });

  function locateMe() {
    if (!navigator.geolocation) return setMessage(t("report.location.geoUnavailable"));
    setMessage(t("report.location.locating"));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = [coords.longitude, coords.latitude];
        if (!insideArea(area, here)) return outside();
        setPin(here);
        setMessage(t("report.location.located", { metres: Math.round(coords.accuracy) }));
      },
      () => setMessage(t("report.location.geoDenied")),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t(area.precision === "approx" ? "report.location.approx" : "report.location.exact", {
          pincode,
        })}
      </p>
      <Suspense fallback={<Skeleton className="h-80 w-full sm:h-96" />}>
        <PinMap
          area={area}
          pin={pin}
          onPin={(p) => {
            setPin(p);
            setMessage("");
          }}
          onOutside={outside}
          label={t("report.location.mapLabel", { pincode })}
        />
      </Suspense>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={locateMe}>
          <LocateFixedIcon aria-hidden="true" />
          {t("report.location.useMine")}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t(pin ? "report.location.keyboardHint" : "report.location.tapHint")}
        </p>
      </div>
      <p aria-live="polite" role="status" className="min-h-6 text-sm">
        {message}
      </p>
      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>
          {t("report.wizard.back")}
        </Button>
        <Button size="lg" disabled={!pin || check.isPending} onClick={() => check.mutate(pin)}>
          {t("report.wizard.next")}
        </Button>
      </div>
    </div>
  );
}
