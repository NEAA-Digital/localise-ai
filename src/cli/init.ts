import path from "path";
import fs from "fs-extra";
import axios from "axios";
import os from "os";
import readline from "readline";

const API_BASE = "http://194.163.167.28:3000/api";

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
  const configPath = path.resolve(process.cwd(), "localise.config.js");

  console.log("⚡ Localise-AI: Initialising...");

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

  let enteredApiKey = "";

  if (hasPaidPlan.toLowerCase() === "yes") {
    enteredApiKey = await askQuestion("🔑 Please enter your API key: ");
  }

  const fingerprint = `${os.hostname()}-${Date.now()}`;

  try {
    const response = await axios.post(`${API_BASE}/register`, {
      fingerprint,
      apiKey: enteredApiKey,
    });

    console.log("🧪 Full backend response:", response.data);

    const registeredApiKey = response.data?.apiKey ?? response.data?.key;
    const projectKey = response.data?.projectKey;

    const finalApiKey = registeredApiKey || enteredApiKey;

    console.log("✅ finalApiKey:", finalApiKey);
    console.log("✅ projectKey:", projectKey);

    if (finalApiKey && projectKey) {
      const configContents = `// ✅ Add this API key to your .env as LOCALISE_AI_KEY
  module.exports = {
    apiKey: "${finalApiKey}", // should come from process.env in production
    projectKey: "${projectKey}",
  };
  `;

      try {
        console.log("Writing config to:", configPath);
        fs.writeFileSync(configPath, configContents);
        console.log("🧠 Created localise.config.js with API and project key.");
      } catch (err: any) {
        console.error(
          "❌ Failed to write localise.config.js:",
          err.message || err
        );
      }
    } else {
      console.warn("⚠️ Missing values", { finalApiKey, projectKey });
    }
  } catch (error: any) {
    console.error(
      "❌ Failed to register project with backend:",
      error?.message || error
    );
  }

  console.log("✅ Localise-AI initialised.");
}
