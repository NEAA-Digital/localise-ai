export type Locale = string;
export type Translations = Record<string, string>;
export type TranslationMap = Record<Locale, Translations>;

let currentLocale: Locale = "en";
let translationsMap: TranslationMap = {};
let currentSnapshot: Translations = {}; // 🔁 Cached stable snapshot

const subscribers = new Set<() => void>();

export function setLocale(locale: Locale) {
  if (!translationsMap[locale]) {
    console.warn(`⚠️ Locale '${locale}' not found in provided translations`);
    return;
  }
  currentLocale = locale;
  updateSnapshot();
  notify();
  console.log(`✅ Locale set to ${locale}`);
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function getTranslations(): Translations {
  return getSnapshot(); // Use stable snapshot
}

export function getAvailableLocales(): Locale[] {
  return Object.keys(translationsMap);
}

function updateSnapshot() {
  currentSnapshot = translationsMap[currentLocale] || {};
}

function getSnapshot(): Translations {
  return currentSnapshot;
}

// --- 🔁 Reactivity Support ---
function notify() {
  subscribers.forEach((cb) => cb());
}

export const localisationStore = {
  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb); // ✅ return unsubscribe function
  },
  unsubscribe(cb: () => void) {
    subscribers.delete(cb);
  },
  setTranslations(map: TranslationMap) {
    translationsMap = map;
    updateSnapshot();
    notify();
  },
  getSnapshot,
};
