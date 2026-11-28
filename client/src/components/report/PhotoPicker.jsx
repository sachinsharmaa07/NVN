import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ImagePlusIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { durations, easings, springs, useMotionSafe } from "@/lib/motion";
import { ACCEPT } from "@/lib/photoUpload";

const STATUS_KEY = {
  preparing: "report.photos.preparing",
  uploading: "report.photos.uploading",
  done: "report.photos.done",
  error: "report.photos.failed",
  too_large: "report.details.photoTooLarge",
  refused: "errors.report.invalidPhoto",
};

/**
 * Up to 3 photos: camera or gallery (no `capture`, so phones offer both), each with progress and Retry.
 * Removing one fades it out in `fast` while the others slide over (layout, springs.snappy); popLayout
 * takes the leaving card out of the flow at once, so the grid never jumps.
 */
export function PhotoPicker({ uploads, label = t("report.photos.label") }) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const { photos, add, retry, remove, full } = uploads;
  const slide = useMotionSafe(springs.snappy);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-medium">{label}</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t("report.photos.hint")}
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {photos.map((p, i) => (
              <m.li
                key={p.id}
                layout
                transition={{ layout: slide }}
                exit={{ opacity: 0, transition: { duration: durations.fast, ease: easings.exit } }}
                className="flex flex-col gap-2 rounded-lg border bg-card p-2"
              >
                <PhotoCard photo={p} n={i + 1} retry={retry} remove={remove} />
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {!full && (
        <div>
          {/* The real input is visually hidden; the label is the 44px button people tap. */}
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            className="peer sr-only"
            aria-describedby={hintId}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = ""; // the same file can be picked again after Remove
            }}
          />
          <Button
            asChild
            variant="outline"
            className="peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
          >
            <label htmlFor={inputId} className="cursor-pointer">
              <ImagePlusIcon aria-hidden="true" />
              {t("report.photos.add")}
            </label>
          </Button>
        </div>
      )}
    </fieldset>
  );
}

// One photo: a reserved 4:3 box (no layout shift) the preview fades into once decoded, a thin
// progress bar along its bottom edge while uploading, its status, and Retry / Remove.
function PhotoCard({ photo: p, n, retry, remove }) {
  const [loaded, setLoaded] = useState(false);
  const grow = useMotionSafe(springs.snappy);
  const failed = ["error", "too_large", "refused"].includes(p.status);
  return (
    <>
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-md bg-muted">
        <img
          src={p.previewUrl}
          alt={t("report.photos.alt", { n })}
          onLoad={() => setLoaded(true)}
          className={loaded ? "fade-in size-full object-cover" : "size-full object-cover opacity-0"}
        />
        {p.status === "uploading" && (
          <div
            role="progressbar"
            aria-label={t("report.photos.progressLabel", { n })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.progress * 100)}
            className="absolute inset-x-0 bottom-0 h-1 bg-background/60"
          >
            {/* scaleX, not width: a transform, so the bar never makes the browser re-layout. */}
            <m.div
              className="h-full origin-left bg-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: p.progress }}
              transition={grow}
            />
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {t(STATUS_KEY[p.status])}
      </p>
      <div className="flex gap-2">
        {p.status === "error" && (
          <Button type="button" variant="outline" onClick={() => retry(p.id)}>
            <RotateCwIcon aria-hidden="true" />
            {t("common.retry")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => remove(p.id)}
          aria-label={t("report.photos.remove", { n })}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}
