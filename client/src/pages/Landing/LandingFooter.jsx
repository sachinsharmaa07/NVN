import { BrandMark } from "@/components/system/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useUpdateProfile";
import { setGuestLanguage } from "@/i18n/guestLanguage";
import { getLanguage, t } from "@/i18n/t";

// PLACEHOLDER: About and Privacy pages don't exist yet, so these point at "#".
const LINKS = [
  { key: "about", href: "#" },
  { key: "privacy", href: "#" },
];

const linkClass =
  "inline-flex min-h-11 min-w-11 justify-center items-center rounded-md underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const buttonClass =
  "inline-flex h-11 items-center rounded-md border px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-pressed:border-input aria-pressed:bg-background aria-pressed:font-medium aria-pressed:text-foreground";

const LANGUAGES = [
  { value: "en", key: "landing.footer.english", lang: "en" },
  { value: "hi", key: "landing.footer.hindi", lang: "hi" },
];

/** The brand, the language choice, a couple of links and the copyright line. */
export function LandingFooter() {
  const { status } = useAuth();
  const saveProfile = useUpdateProfile();
  const current = getLanguage();
  // Signed in: the profile keeps the choice on every device. Signed out: this browser keeps it.
  const choose = (value) =>
    status === "signedIn"
      ? saveProfile.mutate({ preferredLanguage: value })
      : setGuestLanguage(value);

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <BrandMark size="sm" className="text-foreground" />
          <div
            role="group"
            aria-labelledby="landing-language-label"
            className="flex flex-col gap-2"
          >
            <span id="landing-language-label">{t("landing.footer.language")}</span>
            <div className="flex flex-wrap items-center gap-2">
              {LANGUAGES.map(({ value, key, lang }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={current === value}
                  disabled={saveProfile.isPending}
                  onClick={() => current !== value && choose(value)}
                  className={buttonClass}
                >
                  <span lang={lang}>{t(key)}</span>
                </button>
              ))}
            </div>
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
