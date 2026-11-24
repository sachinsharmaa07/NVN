import { t } from "@/i18n/t";

// PLACEHOLDER: About and Privacy pages don't exist yet, so these point at "#".
const LINKS = [
  { key: "about", href: "#" },
  { key: "privacy", href: "#" },
];

const linkClass =
  "inline-flex min-h-11 min-w-11 justify-center items-center rounded-md underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/** Language choice (Hindi coming later), a couple of links and the copyright line. */
export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        {/* PLACEHOLDER: language switch. English is the only language until hi.json exists. */}
        <div role="group" aria-labelledby="landing-language-label" className="flex flex-col gap-2">
          <span id="landing-language-label">{t("landing.footer.language")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed="true"
              className="inline-flex h-11 items-center rounded-md border border-input bg-background px-4 font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              {t("landing.footer.english")}
            </button>
            <button
              type="button"
              disabled
              aria-describedby="landing-hindi-soon"
              className="inline-flex h-11 items-center rounded-md border px-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span lang="hi">{t("landing.footer.hindi")}</span>
            </button>
            <span id="landing-hindi-soon">{t("landing.footer.hindiSoon")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <nav aria-label={t("landing.footer.linksLabel")}>
            <ul className="flex gap-4">
              {LINKS.map(({ key, href }) => (
                <li key={key}>
                  <a href={href} className={linkClass}>
                    {t(`landing.footer.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
