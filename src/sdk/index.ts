import {
  setLocale,
  getCurrentLocale,
  getTranslations,
  getAvailableLocales,
  localisationStore,
} from "./localisationStore";
import { useSyncExternalStore, useMemo } from "react";
import fs from "fs";
import path from "path";

// Attempt to get the API key from the localise.config.js file
function getApiKey(): string | null {
  try {
    const configPath = path.resolve("localise.config.js");
    if (!fs.existsSync(configPath)) return null;
    const config = require(configPath);
    return config.apiKey || null;
  } catch {
    return null;
  }
}

// Validate API key once at runtime (could add backend ping here in future)
const API_KEY = getApiKey();
if (!API_KEY) {
  console.warn(
    "⚠️ Localise-AI: Missing API key in localise.config.js. Translations may not work as expected."
  );
}

// Hook to provide reactive translation function
export function useT() {
  const translations = useSyncExternalStore(
    localisationStore.subscribe,
    localisationStore.getSnapshot
  );

  const t = useMemo(() => {
    return (key: string, args?: Record<string, string | number>) => {
      if (!API_KEY) return key;

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
  if (!API_KEY) {
    console.warn("⚠️ No valid API key found in localise.config.js.");
  }

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
