"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
export function LanguageLinks() {
  const pathname = usePathname();
  return <>{(["vi", "en", "ja"] as const).map(locale => <Link className="lang-link" key={locale} href={pathname.replace(/^\/(vi|en|ja)(?=\/|$)/, `/${locale}`)}>{locale.toUpperCase()}</Link>)}</>;
}
