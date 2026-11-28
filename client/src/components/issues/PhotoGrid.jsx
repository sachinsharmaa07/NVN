import { useState } from "react";
import { PhotoSlot } from "@/components/system/PhotoSlot";
import { t } from "@/i18n/t";

/**
 * Before or after photos of a ticket, as links to the full image. Photos without a `url` (uploads not set
 * up on the server) are left out. `label` names the group, e.g. "Photo from the report". With no photo,
 * `emptyLabel` shows a reserved PhotoSlot instead (the after photo that hasn't been added yet), or the
 * group is left out. Each image keeps its 4:3 box (width/height from the API) and fades in once loaded.
 */
export function PhotoGrid({ photos = [], label, title, emptyLabel }) {
  const shown = photos.filter((p) => p.url);
  if (shown.length === 0 && !emptyLabel) return null;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-muted-foreground">{title}</figcaption>
      {shown.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <PhotoSlot label={emptyLabel} />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((photo, index) => (
            <li key={photo.publicId}>
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                <Photo photo={photo} alt={t("issues.photoAlt", { label, n: index + 1 })} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** One photo in its reserved 4:3 box, fading in once loaded (also used by BeforeAfter). */
export function Photo({ photo, alt }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={photo.url}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`aspect-4/3 w-full rounded-sm border bg-muted object-cover ${loaded ? "fade-in" : "opacity-0"}`}
    />
  );
}
