import Link from "next/link";
import type { Locale } from "../../domain/knowledge/types";
import { t } from "../../i18n/t";
import { LanguageLinks } from "./LanguageLinks";
import { ThemeToggle } from "../theme/ThemeToggle";

export function SiteShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark">AK</span>
          <span>Automation KB</span>
        </Link>
        <nav className="topnav" aria-label="Main">
          <Link href={`/${locale}`}>{t(locale, "nav.home")}</Link>
          <Link href={`/${locale}/about`}>{t(locale, "nav.about")}</Link>
          <Link href="/admin">{t(locale, "nav.admin")}</Link>
          <ThemeToggle />
          <span aria-hidden="true">|</span>
          <LanguageLinks />
        </nav>
      </header>
      {children}
    </div>
  );
}
