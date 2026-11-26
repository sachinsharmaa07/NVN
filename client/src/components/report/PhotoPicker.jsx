import { ImagePlusIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { ACCEPT } from "@/lib/photoUpload";

const STATUS_KEY = {
  preparing: "report.photos.preparing",
  uploading: "report.photos.uploading",
  done: "report.photos.done",
  error: "report.photos.failed",
  too_large: "report.details.photoTooLarge",
  refused: "errors.report.invalidPhoto",
};

/** Up to 3 photos: camera or gallery (no `capture`, so phones offer both), each with progress and Retry. */
export function PhotoPicker({ uploads, label = t("report.photos.label") }) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const { photos, add, retry, remove, full } = uploads;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-medium">{label}</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t("report.photos.hint")}
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => {
            const failed = ["error", "too_large", "refused"].includes(p.status);
            return (
              <li key={p.id} className="flex flex-col gap-2 rounded-lg border bg-card p-2">
                <img
                  src={p.previewUrl}
                  alt={t("report.photos.alt", { n: i + 1 })}
                  className="aspect-4/3 w-full rounded-md object-cover"
                />
                {p.status === "uploading" && (
                  <div
                    role="progressbar"
                    aria-label={t("report.photos.progressLabel", { n: i + 1 })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(p.progress * 100)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.round(p.progress * 100)}%` }}
                    />
                  </div>
                )}
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
                    aria-label={t("report.photos.remove", { n: i + 1 })}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
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
