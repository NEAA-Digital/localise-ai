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

✅ Extracts text nodes and template literals from JSX\
✅ Automatically replaces them with t("key")\
✅ Saves all extracted text to translations/en.json\
✅ Translates keys to any language using Google Translate\
✅ Adds missing imports for t automatically\
✅ Skips files/folders in .localiseignore\
✅ Handles template variables like Hello, {{name}}\
✅ Detects and rewrites basic plural patterns like item(s)\
✅ Works great in CI with --dry-run support\

## 🧪 Commands

### localise-ai init

Initialise project (placeholder for future config setup)

```
localise-ai init
```

### localise-ai replace

Extracts text from your src/ folder, saves it to translations/en.json, and replaces hardcoded strings in-place with t("key").

Supports template literals and variable interpolation.

Automatically adds missing t function from localise-ai-sdk.

Respects .localiseignore to skip specific files or folders.

```
localise-ai replace
```

### localise-ai translate --lang <languages> [--dry-run]

Translates all keys in translations/en.json to the specified language(s).

```
localise-ai translate --lang fr,de
```

You can run this multiple times — only untranslated strings will be sent.

Dry Run Example:

```
localise-ai translate --lang es --dry-run
```

## 📁 File Output

translations/en.json – base English strings

translations/fr.json, de.json, etc. – translated output

## 📂 .localiseignore

Create a .localiseignore file to exclude paths during replacement:

src/commands/\
src/utils/

## 🚧 Upcoming Features

Free tier limits and paid usage tracking

Fully-featured SDK with runtime t() handling

Locale switching and pluralisation formatting

CLI login & usage-based billing system

## 📦 SDK

When you import the SDK:

```
import { t } from "localise-ai";
```

You’ll get a lightweight t() function to handle runtime translation lookup and variable interpolation.

## 👷 Status

This is an active WIP. Expect rapid iteration over the next few weeks.
Contributions and feedback welcome once live.

## Licence

MIT

---
