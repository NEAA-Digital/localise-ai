import fs from "fs-extra";
import path from "path";
import * as babel from "@babel/core";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const SOURCE_LANG = "en";
const TRANSLATIONS_DIR = "translations";
const CONFIG_FILE = "localise.config.js";
const API_BASE = process.env.LOCALISE_API_BASE || "http://localhost:3000/api";

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

function findRootComponent(): string | null {
  const potentialFiles = [
    "app/_layout.tsx",
    "app/_layout.jsx",
    "app/index.tsx",
    "app/index.jsx",
  ];
  for (const file of potentialFiles) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function updateInitLocalisationCall(langs: string[], dryRun: boolean) {
  const rootFile = findRootComponent();
  if (!rootFile) {
    console.log("❌ Could not find root layout file.");
    return;
  }

  const code = fs.readFileSync(rootFile, "utf-8");
  const ast = babel.parseSync(code, {
    sourceType: "module",
    plugins: [
      ["@babel/plugin-transform-typescript", { isTSX: true }],
      "@babel/plugin-transform-react-jsx",
    ],
  }) as t.File;

  const importMap = new Map<string, t.ImportDeclaration>();

  ast.program.body.forEach((node) => {
    if (
      t.isImportDeclaration(node) &&
      node.source.value.startsWith("../translations/")
    ) {
      const lang = path.basename(node.source.value, ".json");
      importMap.set(lang, node);
    }
  });

  const toAdd = langs.filter((lang) => !importMap.has(lang));
  for (const lang of toAdd) {
    const importDecl = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(lang))],
      t.stringLiteral(`../translations/${lang}.json`)
    );
    importMap.set(lang, importDecl);
  }

  const sortedImports = Array.from(importMap.entries())
    .sort((a, b) => a[1].source.value.localeCompare(b[1].source.value))
    .map(([, decl]) => decl);

  ast.program.body = ast.program.body.filter(
    (node) =>
      !(
        t.isImportDeclaration(node) &&
        node.source.value.startsWith("../translations/")
      )
  );

  const firstNonImport = ast.program.body.findIndex(
    (n) => !t.isImportDeclaration(n)
  );
  ast.program.body.splice(firstNonImport, 0, ...sortedImports);

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: "initLocalisation" }) &&
        path.node.arguments.length === 2 &&
        t.isObjectExpression(path.node.arguments[1])
      ) {
        const existingProps = new Set(
          path.node.arguments[1].properties.map((p) =>
            t.isObjectProperty(p) && t.isIdentifier(p.key)
              ? p.key.name
              : "unknown"
          )
        );

        for (const lang of langs) {
          if (!existingProps.has(lang)) {
            (path.node.arguments[1] as t.ObjectExpression).properties.push(
              t.objectProperty(
                t.identifier(lang),
                t.identifier(lang),
                false,
                true
              )
            );
          }
        }
      }
    },
  });

  if (!dryRun) {
    const output = generate(ast, {}, code).code;
    fs.writeFileSync(rootFile, output);
    console.log(`🛠️ Updated initLocalisation in ${rootFile}`);
  } else {
    console.log("🧪 Dry run: would update initLocalisation imports");
  }
}

function getConfig(): { apiKey: string; projectKey: string } | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const config = require(path.resolve(CONFIG_FILE));
    return {
      apiKey: config.apiKey,
      projectKey: config.projectKey,
    };
  } catch {
    return null;
  }
}

export async function runTranslateCommand(
  targetLangs: string[],
  dryRun = false
) {
  const config = getConfig();
  if (!config || !config.apiKey || !config.projectKey) {
    console.log("❌ Missing API or project key. Run `localise-ai init` first.");
    return;
  }

  const sourcePath = path.join(TRANSLATIONS_DIR, `${SOURCE_LANG}.json`);
  if (!fs.existsSync(sourcePath)) {
    console.log(`❌ No ${SOURCE_LANG}.json file found.`);
    return;
  }

  const sourceData: Record<string, string> = fs.readJSONSync(sourcePath);
  const updatedLangs: string[] = [];

  for (const lang of targetLangs) {
    const targetPath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
    const targetData: Record<string, string> = fs.existsSync(targetPath)
      ? fs.readJSONSync(targetPath)
      : {};

    const untranslatedKeys: Record<string, string> = {};
    for (const key of Object.keys(sourceData)) {
      if (!targetData[key]) {
        untranslatedKeys[key] = sourceData[key];
      }
    }

    if (Object.keys(untranslatedKeys).length === 0) {
      console.log(`ℹ️ No new strings to translate for ${lang}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `🧪 Would translate ${Object.keys(untranslatedKeys).length} string(s) to ${lang}`
      );
      continue;
    }

    try {
      const response = await axios.post(`${API_BASE}/translate`, {
        apiKey: config.apiKey,
        projectKey: config.projectKey,
        fromLang: SOURCE_LANG,
        toLang: lang,
        keys: untranslatedKeys,
      });

      const translated = response.data?.translated as Record<string, string>;
      if (translated && typeof translated === "object") {
        for (const [key, val] of Object.entries(translated)) {
          const cleaned = cleanICUPlural(val);
          targetData[key] = cleaned;
        }

        fs.writeJSONSync(targetPath, targetData, { spaces: 2 });
        updatedLangs.push(lang);
        console.log(
          `✅ Translated ${Object.keys(translated).length} string(s) to ${lang}`
        );
      } else {
        console.warn(`⚠️ No translations returned for ${lang}`);
      }
    } catch (err: any) {
      console.error(`🔴 Error translating to ${lang}:`, err.message);
    }
  }

  if (updatedLangs.length && !dryRun) {
    updateInitLocalisationCall([SOURCE_LANG, ...updatedLangs], dryRun);
  }
}
