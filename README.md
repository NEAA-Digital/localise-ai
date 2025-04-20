# 🧠 Localise-AI

AI-powered CLI to automatically extract, translate, and replace hardcoded strings in your React Native (or React) app — with minimal setup.

---

## 🚀 Quickstart

Install globally or as a dev dependency:

npm install localise-ai

Then inside your React Native project:

npx localise-ai init
npx localise-ai replace
npx localise-ai translate --lang fr,de

## 🛠 What It Does

✅ Extracts hardcoded strings from JSX (including JSXText, JSX attributes, ternaries)\
✅ Replaces them with `t("key")`\
✅ Automatically adds `const t = useT() and import { useT } from "localise-ai"`\
✅ Saves all strings to `translations/en.json`\
✅ Translates into any language using a local dev-friendly engine\
✅ Updates `initLocalisation("en", { en, fr, ... })` with new imports\
✅ Handles ICU-style plurals like `item(s)` and ternaries\
✅ Supports `{{placeholders}}` in strings\
✅ Fully repeatable CLI – safely run multiple times\
✅ Works great in CI with `--dry-run` mode\
✅ Skips files/folders in `.localiseignore`\

## 🧪 Commands

### -> localise-ai init

Initialise project (placeholder for future config setup)

```
localise-ai init
```

### -> localise-ai replace

Scans your project for hardcoded strings, extracts them into translations/en.json, and replaces them with t("key").

Adds `import { useT } from "localise-ai" and const t = useT();` if missing.

Automatically detects pluralisation (e.g. ternaries using count).

Supports JSXText, string attributes, and ternary strings.

Skips files/folders in `.localiseignore`.

```
localise-ai replace
```

### -> localise-ai translate --lang <languages> [--dry-run]

Translates missing keys in `translations/en.json` into the specified languages.

Smartly skips already-translated keys.

Automatically adds new imports and updates `initLocalisation(...)` in your app root.

Safe to run multiple times.

```
localise-ai translate --lang fr,de
```

Dry Run Example:

```
localise-ai translate --lang es --dry-run
```

## 📁 Output Structure

```
translations/
├── en.json      # Source language
├── fr.json      # French translation
├── de.json      # German translation
```

## 📂 .localiseignore

Create a `.localiseignore` file to exclude paths during replacement:

```
src/cli/\
src/utils/
```

## 📦 SDK

At runtime, use the SDK to handle all translations and locale switching.

### -> useT()

Use this inside components to access the translation function reactively:

```
import { useT } from "localise-ai";

const t = useT();

t("home.welcome"); // → "Welcome"
t("home.welcome", { name: "Alice" }); // → "Welcome, Alice"
```

Automatically re-renders when locale changes

Supports placeholders (e.g. `Hello, {{name}}`)

Supports ICU plural rules (e.g. `{count, plural, one {...} other {...}}`)

### -> setLocale(locale: string)

Globally switch the current locale at runtime:

```
import { setLocale } from "localise-ai";

setLocale("fr"); // Switch to French
```

All components using `useT()` will re-render with the new locale.

### -> initLocalisation(defaultLocale, translationsMap)

Used once at app startup to initialise localisation:

```
import en from "../translations/en.json";
import fr from "../translations/fr.json";
import { initLocalisation } from "localise-ai";

initLocalisation("en", { en, fr });
```

The CLI injects this automatically into your root layout if it's missing.

### -> getCurrentLocale() & getAvailableLocales()

If you want to display or persist language settings:

```
import { getCurrentLocale, getAvailableLocales } from "localise-ai";

const current = getCurrentLocale();     // e.g. "en"
const options = getAvailableLocales();  // e.g. ["en", "fr", "de"]
```

`getAvailableLocales()` returns the keys passed into `initLocalisation(...)`, based on your available `translations/*.json` files.

## 👷 Status

Localise-AI is in active development. Feedback welcome..

## 🪪 Licence

MIT

---
