import path from "path";
import fs from "fs-extra";
import axios from "axios";
import os from "os";
import readline from "readline";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

export async function runInit() {
  const defaultLang = "en";
  const translationsDir = "translations";
  const enFilePath = path.join(translationsDir, `${defaultLang}.json`);
  const configPath = "localise.config.js";

  if (!fs.existsSync(translationsDir)) {
    fs.mkdirSync(translationsDir);
  }

  if (!fs.existsSync(enFilePath)) {
    fs.writeJsonSync(enFilePath, {}, { spaces: 2 });
    console.log("📁 Created translations/en.json");
  }

  const hasPaidPlan = await askQuestion(
    "🧾 Do you have a paid Localise-AI plan? (yes/no): "
  );

  let apiKey = "";

  if (hasPaidPlan.toLowerCase() === "yes") {
    apiKey = await askQuestion("🔑 Please enter your API key: ");
  }

  // Unique project fingerprint
  const fingerprint = `${os.hostname()}-${Date.now()}`;

  try {
    const response = await axios.post("https://your-api.com/api/register", {
      fingerprint,
      apiKey,
    });

    const registeredApiKey = response.data?.apiKey;
    const projectKey = response.data?.projectKey;

    if (registeredApiKey && projectKey) {
      const configContents = `// ✅ Add this API key to your .env as LOCALISE_AI_KEY
module.exports = {
  apiKey: "${registeredApiKey}", // should come from process.env in production
  projectKey: "${projectKey}",
};
`;
      fs.writeFileSync(configPath, configContents);
      console.log("🧠 Created localise.config.js with API and project key.");
    } else {
      console.warn("⚠️ Backend response did not return expected keys.");
    }
  } catch (error: any) {
    console.error("❌ Failed to register project with backend:", error.message);
  }

  console.log("✅ Localise-AI initialised.");
}
