import express, { Router, Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";

const router: Router = express.Router();

// Register project and return API key
router.post("/register", async (req: Request, res: Response): Promise<any> => {
  const fingerprint = req.body.fingerprint;

  if (!fingerprint) {
    return res.status(400).json({ error: "Missing fingerprint" });
  }

  // Fake API key and project key for testing
  const apiKey = crypto.randomBytes(32).toString("hex");
  const projectKey = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  // Simulate successful response
  res.json({ apiKey, projectKey });
});

// Helper: Call LibreTranslate
const translateText = async (
  text: string,
  toLang: string,
  fromLang: string
): Promise<string> => {
  try {
    const response = await axios.post(
      "http://194.163.167.28:5000/translate", // ⚡ CORRECT LibreTranslate server!
      {
        q: text,
        source: fromLang,
        target: toLang,
        format: "text",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data?.translatedText ?? "";
  } catch (err: any) {
    console.error("LibreTranslate error:", err.message);
    return text; // fallback
  }
};

// Translate endpoint (no DB)
router.post("/translate", async (req: Request, res: Response): Promise<any> => {
  const { apiKey, fromLang, toLang, keys } = req.body;

  if (!apiKey || !fromLang || !toLang || !keys || typeof keys !== "object") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Fake project check for testing
    const fakeProject = { usage: 0, save: async () => {} };

    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(keys)) {
      translated[key] = await translateText(value as string, toLang, fromLang);
    }

    fakeProject.usage += Object.keys(keys).length;
    await fakeProject.save();

    res.json({ translated });
  } catch (err: any) {
    console.error("Translation error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
