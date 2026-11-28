import { Photo } from "@/components/issues/PhotoGrid";
import { PhotoSlot } from "@/components/system/PhotoSlot";
import { t } from "@/i18n/t";

/**
 * A ticket's photos as one before/after pair (review m10): two columns at every width, captioned
 * "Before" and "After" like Landing's trust section. More than one photo on a side stacks in its column.
 * No after photo yet: while the issue is open, the After column holds a reserved slot; once it is closed
 * without one, Before keeps its half width alone. Each photo keeps its 4:3 box before it loads.
 */
export function BeforeAfter({ before = [], after = [], open }) {
  const shownBefore = before.filter((p) => p.url);
  const shownAfter = after.filter((p) => p.url);
  const afterPending = shownAfter.length === 0 && open;
  if (shownBefore.length === 0 && shownAfter.length === 0 && !afterPending) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {shownBefore.length > 0 && (
        <Side
          photos={shownBefore}
          label={t("issues.photos.before")}
          caption={t("issues.photos.beforeCaption")}
        />
      )}
      {shownAfter.length > 0 && (
        <Side
          photos={shownAfter}
          label={t("issues.photos.after")}
          caption={t("issues.photos.afterCaption")}
        />
      )}
      {afterPending && (
        <figure className="col-start-2 flex flex-col gap-2">
          <PhotoSlot label={t("issues.photos.after")} />
          <figcaption className="font-medium">{t("issues.photos.afterCaption")}</figcaption>
        </figure>
      )}
    </div>
  );
}

function Side({ photos, label, caption }) {
  return (
    <figure className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {photos.map((photo, index) => (
          <li key={photo.publicId}>
            <a href={photo.url} target="_blank" rel="noreferrer" className="block">
              <Photo photo={photo} alt={t("issues.photoAlt", { label, n: index + 1 })} />
            </a>
          </li>
        ))}
      </ul>
      <figcaption className="font-medium">{caption}</figcaption>
    </figure>
  );
}
