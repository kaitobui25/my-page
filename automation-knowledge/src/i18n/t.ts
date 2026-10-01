import type { Locale } from "../domain/knowledge/types";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import vi from "./locales/vi.json";

const dictionaries = { vi, en, ja };

export function t(locale: Locale, key: keyof typeof vi) {
  return dictionaries[locale][key] ?? vi[key] ?? key;
}
