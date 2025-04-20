//
import path from "path";
import fs from "fs-extra";

export function runInit() {
  const defaultLang = "en";
  const translationsDir = "translations";
  const enFilePath = path.join(translationsDir, `${defaultLang}.json`);

  if (!fs.existsSync(translationsDir)) {
    fs.mkdirSync(translationsDir);
  }

  if (!fs.existsSync(enFilePath)) {
    fs.writeJsonSync(enFilePath, {}, { spaces: 2 });
    console.log("📁 Created translations/en.json");
  }

  console.log("🛠 Localise-AI: Initialising...");
  // You can scaffold config files or prepare folders here
}
