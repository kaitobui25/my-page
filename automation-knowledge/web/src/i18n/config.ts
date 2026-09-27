import type { Locale } from "../knowledge/types";

export const locales: Locale[] = ["vi", "en", "ja"];
export const defaultLocale: Locale = "vi";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
