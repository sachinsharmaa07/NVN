import { t } from "@/i18n/t";

/**
 * Before or after photos of a ticket, as links to the full image. Photos without a `url` (uploads not set
 * up on the server) are left out. `label` names the group, e.g. "Photo from the report".
 */
export function PhotoGrid({ photos = [], label, title }) {
  const shown = photos.filter((p) => p.url);
  if (shown.length === 0) return null;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-muted-foreground">{title}</figcaption>
      <ul className="grid grid-cols-3 gap-2">
        {shown.map((photo, index) => (
          <li key={photo.publicId}>
            <a href={photo.url} target="_blank" rel="noreferrer" className="block">
              <img
                src={photo.url}
                alt={t("issues.photoAlt", { label, n: index + 1 })}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="aspect-square w-full rounded-md border object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </figure>
  );
}
