import fs from "fs-extra";
import path from "path";
import { translate } from "@vitalets/google-translate-api";

function cleanICUPlural(value: string): string {
  if (!value.includes("plural")) return value;

  return value
    .replace(/\b(Eins|Un|Uno|Ein|Une|eins|un|uno|ein|une)\b/g, "one")
    .replace(/\b(Andere|Autres|Otros|Sonstiges|autre|andere|otros)\b/g, "other")
    .replace(/\b(pluriel|plural|plurale?)\b/gi, "plural")
    .replace(/\b(Count|count)\b/, "count")
    .replace(/\(\s?s\s?\)/g, "")
    .replace(/item\s*\(s\)/gi, "item(s)");
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function runTranslateCommand(
  targetLangs: string[],
  dryRun = false
) {
  const sourceLang = "en";
  const sourcePath = path.join("translations", `${sourceLang}.json`);

  if (!fs.existsSync(sourcePath)) {
    console.log(`❌ No ${sourceLang}.json file found.`);
    return;
  }

  const sourceData = fs.readJSONSync(sourcePath);

  for (const lang of targetLangs) {
    const targetPath = path.join("translations", `${lang}.json`);
    const targetData = fs.existsSync(targetPath)
      ? fs.readJSONSync(targetPath)
      : {};

    const untranslatedKeys = Object.keys(sourceData).filter(
      (key) => !targetData[key]
    );

    if (dryRun) {
      console.log(
        untranslatedKeys.length > 0
          ? `🧪 Would translate ${untranslatedKeys.length} string(s) to ${lang}`
          : `ℹ️ No new strings to translate for ${lang}`
      );
      continue;
    }

    let translatedCount = 0;

    for (const key of untranslatedKeys) {
      try {
        await delay(1500);

        const res = await translate(sourceData[key], {
          from: sourceLang,
          to: lang,
        });

        const cleaned = cleanICUPlural(res.text);
        targetData[key] = cleaned;
        translatedCount++;
      } catch (err: any) {
        console.error(
          `🔴 Failed to translate '${key}' to '${lang}':`,
          err.message
        );
      }
    }

    fs.writeJSONSync(targetPath, targetData, { spaces: 2 });
    console.log(
      translatedCount > 0
        ? `✅ ${translatedCount} new strings translated to ${lang}`
        : `ℹ️ No new strings to translate for ${lang}`
    );
  }
}
