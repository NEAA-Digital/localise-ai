import {
  setLocale,
  getCurrentLocale,
  getTranslations,
  getAvailableLocales,
  localisationStore,
} from "./localisationStore";
import { useSyncExternalStore, useMemo } from "react";

type TranslateArgs = {
  [key: string]: string | number;
};

// Hook to provide reactive translation function
export function useT() {
  const translations = useSyncExternalStore(
    localisationStore.subscribe,
    localisationStore.getSnapshot
  );

  const t = useMemo(() => {
    return (key: string, args?: Record<string, string | number>) => {
      let template = translations[key] || key;
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          template = template.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return template;
    };
  }, [translations]);

  return t;
}

// Initialise translations + default locale
export function initLocalisation(
  locale: string = "en",
  translations: Record<string, Record<string, string>>
) {
  if (!translations[locale]) {
    console.warn(
      `⚠️ Translations missing locale '${locale}', falling back to 'en'.`
    );
    locale = "en";
  }

  localisationStore.setTranslations(translations);
  setLocale(locale);
}

// Non-reactive exports
export { setLocale, getCurrentLocale, getTranslations, getAvailableLocales };
