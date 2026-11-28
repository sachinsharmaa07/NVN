import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Counterfoil } from "@/components/report/Counterfoil";
import { DetailsStep } from "@/components/report/DetailsStep";
import { MapStep } from "@/components/report/MapStep";
import { PincodeStep } from "@/components/report/PincodeStep";
import { clearDraft, readDraft, saveDraft } from "@/components/report/reportDraft";
import { StartOver } from "@/components/report/StartOver";
import { StepSlide } from "@/components/report/StepSlide";
import { usePhotoUploads } from "@/components/report/usePhotoUploads";
import { FormStrip } from "@/components/system/FormStrip";
import { PageHeader } from "@/components/system/PageHeader";
import { useApi } from "@/hooks/useApi";
import { t } from "@/i18n/t";
import { isValidPincode } from "@/pages/Landing/pincode";
import { useClaimPagePrimary } from "@/hooks/usePagePrimary";

const STEP_TITLES = ["report.wizard.step1", "report.wizard.step2", "report.wizard.step3"];

/** The step in the URL, pulled back to the first step whose input is still missing from the draft. */
function stepFrom(param, draft) {
  const asked = ["2", "3"].includes(param) ? Number(param) : 1;
  if (asked >= 2 && !isValidPincode(draft.pincode)) return 1;
  if (asked === 3 && draft.lat == null) return 2;
  return asked;
}

// The 3-step report wizard (docs/UI.md §7). The step lives in the URL (?step=1..3) so Back works.
// A landing link /report?pincode=144401 prefills step 1; otherwise the session draft does.
export function Report() {
  const api = useApi();
  // Next / Submit report / Track this issue: its own primary button, so the sidebar's Report turns outline (one primary per screen).
  useClaimPagePrimary();
  const [searchParams, setSearchParams] = useSearchParams();
  const draft = readDraft();
  const step = stepFrom(searchParams.get("step"), draft);
  const fromLink = searchParams.get("pincode");
  const initialPin = isValidPincode(fromLink) ? fromLink : (draft.pincode ?? "");
  const goTo = (n) => setSearchParams({ step: String(n) });

  // Photos live here, not in a step, so going Back to the map keeps them.
  const uploads = usePhotoUploads();
  // Set when a submit comes back 422 OUTSIDE_PINCODE, shown once the map step opens again.
  const [mapNotice, setMapNotice] = useState("");
  const [issue, setIssue] = useState(null);
  // Bumped by Start over, so step 1 remounts empty even when it is already showing.
  const [resets, setResets] = useState(0);
  // The receipt's heading is the page h1; it takes focus so screen readers hear "Report submitted".
  const title = useRef(null);
  useEffect(() => {
    if (issue) title.current?.focus();
  }, [issue]);
  // Set synchronously on the first click: a double click lands before React re-renders Submit as disabled.
  const inFlight = useRef(false);

  const send = useMutation({
    mutationFn: (fields) => {
      const { pincode, lat, lng, key = crypto.randomUUID() } = readDraft();
      // One key per draft, saved before sending: a retry or a double tap can never make two tickets.
      saveDraft({ key });
      return api("/api/issues", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: { pincode, lat, lng, ...fields, photos: uploads.publicIds },
      });
    },
    onSuccess: (created) => {
      clearDraft();
      setIssue(created);
    },
    onError: (err) => {
      if (err.code === "OUTSIDE_PINCODE") {
        setMapNotice(t("report.location.outsidePincode", { pincode: draft.pincode }));
        goTo(2);
      } else if (err.code === "INVALID_PHOTO") {
        uploads.refuse(err.details?.index ?? 0);
      }
    },
  });
  const sendError =
    send.error && send.error.code !== "OUTSIDE_PINCODE"
      ? `${send.error.message} ${t("report.review.draftSaved")}`
      : "";

  function startOver() {
    clearDraft();
    uploads.clear();
    send.reset();
    setMapNotice("");
    setResets((n) => n + 1);
    setSearchParams({ step: "1" });
  }

  const steps = STEP_TITLES.map((key) => ({ title: t(key) }));
  // Start over only once there is something to throw away (a saved draft, a later step or a photo).
  const hasDraft = step > 1 || Object.keys(draft).length > 0 || uploads.publicIds.length > 0;
  return (
    // The same centred max-w-6xl frame as every page, so the title starts at the same x (review m12); the
    // wizard itself stays a 640px column, aligned left. pb-16 below 1024px: with content-reserve, keeps the last field clear of the fixed Back/Next bar,
    // even when it shows its hint line (measured at 360 on all three steps).
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 *:max-w-160 md:px-6 md:pt-12 lg:px-8 lg:pb-12">
      <PageHeader
        title={issue ? t("report.done.title") : t("shell.report.title")}
        titleRef={title}
        inlineActions
        // The "three steps" line is for the task; above a finished receipt it would be instructions for nothing.
        description={issue ? undefined : t("shell.report.description")}
        actions={
          !issue && hasDraft ? (
            <StartOver publicIds={uploads.publicIds} onReset={startOver} />
          ) : null
        }
      />
      {!issue && (
        <nav aria-label={t("report.wizard.stepsLabel")}>
          <FormStrip
            steps={steps}
            current={step - 1}
            collapsed
            stepLabel={t("report.wizard.stepCount", { step, total: 3 })}
          />
        </nav>
      )}
      {issue ? (
        <Counterfoil
          issue={issue}
          onReportAnother={() => {
            setIssue(null);
            send.reset();
            goTo(1);
          }}
        />
      ) : (
        <>
          {/* The strip shows the step; screen readers hear the change here. */}
          <h2 aria-live="polite" className="sr-only">
            {t("report.wizard.stepOf", { step, total: 3, title: t(STEP_TITLES[step - 1]) })}
          </h2>
          <StepSlide step={step}>
            {step === 1 && (
              <PincodeStep
                key={resets}
                initialPin={initialPin}
                onNext={(pin) => {
                  saveDraft({ pincode: pin });
                  goTo(2);
                }}
              />
            )}
            {step === 2 && (
              <MapStep
                pincode={draft.pincode}
                saved={draft.lng != null ? [draft.lng, draft.lat] : null}
                notice={mapNotice}
                onBack={() => goTo(1)}
                onNext={({ lat, lng, precision }) => {
                  saveDraft({ lat, lng, precision });
                  setMapNotice("");
                  goTo(3);
                }}
              />
            )}
            {step === 3 && (
              <DetailsStep
                draft={draft}
                uploads={uploads}
                submit={{ pending: send.isPending, error: sendError }}
                onBack={() => goTo(2)}
                onSubmit={(fields) => {
                  if (inFlight.current) return;
                  inFlight.current = true;
                  send.mutate(fields, { onSettled: () => (inFlight.current = false) });
                }}
              />
            )}
          </StepSlide>
        </>
      )}
    </div>
  );
}

export default Report;
