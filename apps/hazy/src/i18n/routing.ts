export const LOCALES = ["en", "ja"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return value === "en" || value === "ja";
}

export function detectDefaultLocale(): AppLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}
