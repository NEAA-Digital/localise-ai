import express, { Router, Request, Response } from "express";
import crypto from "crypto";
import Project from "../models/project";
import axios from "axios";

const router: Router = express.Router();

// Register project and return API key
router.post("/register", async (req: Request, res: Response): Promise<any> => {
  const fingerprint = req.body.fingerprint;

  if (!fingerprint) {
    return res.status(400).json({ error: "Missing fingerprint" });
  }

  const projectKey = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  const apiKey = crypto.randomBytes(32).toString("hex");

  try {
    const existing = await Project.findOne({ projectKey });
    if (existing) {
      return res.json({ key: existing.apiKey });
    }

    const newProject = new Project({ projectKey, apiKey });
    await newProject.save();

    res.json({ key: apiKey });
  } catch (err: any) {
    console.error("Registration error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

const translateText = async (
  text: string,
  toLang: string,
  fromLang: string
): Promise<string> => {
  try {
    const response = await axios.post(
      "http://194.163.167.28:5000/translate",
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
    return text; // Fallback to original if translation fails
  }
};

// Translate endpoint
router.post("/translate", async (req: Request, res: Response): Promise<any> => {
  const { apiKey, fromLang, toLang, keys } = req.body;

  if (!apiKey || !fromLang || !toLang || !keys || typeof keys !== "object") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const project = await Project.findOne({ apiKey });
    if (!project) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(keys)) {
      translated[key] = await translateText(value as string, toLang, fromLang);
    }

    project.usage += Object.keys(keys).length;
    await project.save();

    res.json({ translated });
  } catch (err: any) {
    console.error("Translation error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
