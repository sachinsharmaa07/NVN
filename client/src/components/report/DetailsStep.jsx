import { useId, useRef, useState } from "react";
import { CategoryCards } from "@/components/report/CategoryCards";
import { CATEGORIES } from "@/components/report/categories";
import { PhotoPicker } from "@/components/report/PhotoPicker";
import { saveDraft } from "@/components/report/reportDraft";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/t";

const LIMITS = { titleMin: 5, titleMax: 100, descMin: 20, descMax: 1000 };

function problemsOf({ category, title, description }) {
  const p = {};
  if (!category) p.category = t("report.details.categoryRequired");
  if (title.trim().length < LIMITS.titleMin) p.title = t("report.details.titleShort");
  if (description.trim().length < LIMITS.descMin) p.description = t("report.details.descShort");
  return p;
}

/**
 * Report step 3: what, a few words, photos, then a review and Submit. Text lives in the session
 * draft; photos only in memory (`uploads` from usePhotoUploads). `submit` is the parent's mutation.
 */
export function DetailsStep({ draft, uploads, submit, onBack, onSubmit }) {
  const id = useId();
  const [fields, setFields] = useState({
    category: draft.category ?? "",
    title: draft.title ?? "",
    description: draft.description ?? "",
  });
  const [tried, setTried] = useState(false);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const problems = tried ? problemsOf(fields) : {};
  const set = (key) => (value) => {
    setFields((f) => ({ ...f, [key]: value }));
    saveDraft({ [key]: value });
  };
  const count = fields.description.trim().length;

  function send(e) {
    e.preventDefault();
    setTried(true);
    const found = problemsOf(fields);
    if (Object.keys(found).length) {
      // Focus the first field that needs fixing (UI.md §7, inline validation).
      const first = ["category", "title", "description"].find((k) => found[k]);
      if (first === "category") document.getElementsByName("category")[0]?.focus();
      else (first === "title" ? titleRef : descRef).current?.focus();
      return;
    }
    onSubmit({ ...fields, title: fields.title.trim(), description: fields.description.trim() });
  }

  return (
    <form noValidate onSubmit={send} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <CategoryCards
          value={fields.category}
          onChange={set("category")}
          invalid={Boolean(problems.category)}
          errorId={`${id}-category`}
        />
        <FieldError id={`${id}-category`}>{problems.category}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>{t("report.details.titleLabel")}</Label>
        <Input
          id={`${id}-title`}
          ref={titleRef}
          value={fields.title}
          maxLength={LIMITS.titleMax}
          onChange={(e) => set("title")(e.target.value)}
          aria-invalid={Boolean(problems.title) || undefined}
          aria-describedby={problems.title ? `${id}-title-error` : undefined}
          placeholder={t("report.details.titlePlaceholder")}
        />
        <FieldError id={`${id}-title-error`}>{problems.title}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-desc`}>{t("report.details.descLabel")}</Label>
        <Textarea
          id={`${id}-desc`}
          ref={descRef}
          rows={5}
          value={fields.description}
          maxLength={LIMITS.descMax}
          onChange={(e) => set("description")(e.target.value)}
          aria-invalid={Boolean(problems.description) || undefined}
          aria-describedby={`${id}-count ${problems.description ? `${id}-desc-error` : ""}`.trim()}
        />
        <p id={`${id}-count`} className="text-sm text-muted-foreground tabular-nums">
          {count < LIMITS.descMin
            ? t("report.details.countShort", { count, min: LIMITS.descMin })
            : t("report.details.count", { count, max: LIMITS.descMax })}
        </p>
        <FieldError id={`${id}-desc-error`}>{problems.description}</FieldError>
      </div>

      <PhotoPicker uploads={uploads} />

      <section
        aria-labelledby={`${id}-review`}
        className="flex flex-col gap-3 rounded-lg border p-4 md:p-6"
      >
        <h2 id={`${id}-review`} className="font-display text-xl font-semibold">
          {t("report.review.title")}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("report.review.pincode")}</dt>
          <dd>{draft.pincode}</dd>
          <dt className="text-muted-foreground">{t("report.review.location")}</dt>
          <dd>
            {t(draft.precision === "exact" ? "report.review.pinExact" : "report.review.pinApprox")}
          </dd>
          <dt className="text-muted-foreground">{t("report.review.category")}</dt>
          <dd>
            {fields.category ? t(CATEGORIES.find((c) => c.value === fields.category).label) : "–"}
          </dd>
          <dt className="text-muted-foreground">{t("report.review.photos")}</dt>
          <dd>{t("report.review.photoCount", { count: uploads.publicIds.length })}</dd>
        </dl>
      </section>

      <p role="alert" className="text-sm text-destructive empty:hidden">
        {submit.error}
      </p>
      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          {t("report.wizard.back")}
        </Button>
        <Button type="submit" size="lg" disabled={submit.pending || !uploads.ready}>
          {t(submit.pending ? "report.review.submitting" : "report.review.submit")}
        </Button>
      </div>
    </form>
  );
}
