import { ja } from "./ja";
import { en } from "./en";

export type Locale = typeof ja;
export type Language = "ja" | "en";

export const locales: Record<Language, Locale> = { ja, en };

export function getLocale(lang: Language): Locale {
  return locales[lang] ?? ja;
}
