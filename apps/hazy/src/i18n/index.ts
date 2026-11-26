import i18n from "i18next";
import { useCallback } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import { useParams } from "react-router";
import enMessages from "../../messages/en.json";
import jaMessages from "../../messages/ja.json";
import { type AppLocale, DEFAULT_LOCALE, detectDefaultLocale, isAppLocale } from "./routing";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: enMessages },
      ja: { translation: jaMessages },
    },
    lng: detectDefaultLocale(),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      prefix: "{",
      suffix: "}",
      escapeValue: false,
    },
  });
}

export function useTranslations(namespace?: string) {
  const { t } = useTranslation(undefined, { keyPrefix: namespace });
  return useCallback(
    (key: string, values?: Record<string, string | number>): string =>
      String(t(key as never, values as never)),
    [t]
  );
}

export function useLocale(): AppLocale {
  const { locale } = useParams<{ locale?: string }>();
  if (isAppLocale(locale)) return locale;
  return isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export default i18n;
