import fs from "fs-extra";
import path from "path";
import * as babel from "@babel/core";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

const SOURCE_LANG = "en";
const TRANSLATIONS_DIR = "translations";

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

// Simulated translation function for dev mode
async function fakeTranslate(text: string, to: string): Promise<string> {
  return `[${to.toUpperCase()}] ${text}`;
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

  // Track existing translation imports
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

  // Add any new import declarations
  for (const lang of toAdd) {
    const importDecl = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(lang))],
      t.stringLiteral(`../translations/${lang}.json`)
    );
    importMap.set(lang, importDecl);
  }

  // Sort all translation imports alphabetically by path
  const sortedImports = Array.from(importMap.entries())
    .sort((a, b) => a[1].source.value.localeCompare(b[1].source.value))
    .map(([, decl]) => decl);

  // Remove all previous translation imports from AST
  ast.program.body = ast.program.body.filter(
    (node) =>
      !(
        t.isImportDeclaration(node) &&
        node.source.value.startsWith("../translations/")
      )
  );

  // Insert sorted translation imports after general imports
  const firstNonImport = ast.program.body.findIndex(
    (n) => !t.isImportDeclaration(n)
  );
  ast.program.body.splice(firstNonImport, 0, ...sortedImports);

  // Add to initLocalisation object
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

export async function runTranslateCommand(
  targetLangs: string[],
  dryRun = false
) {
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

    const untranslatedKeys = Object.keys(sourceData).filter(
      (key) => !targetData[key]
    );

    if (untranslatedKeys.length === 0) {
      console.log(`ℹ️ No new strings to translate for ${lang}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `🧪 Would translate ${untranslatedKeys.length} string(s) to ${lang}`
      );
      continue;
    }

    let translatedCount = 0;

    for (const key of untranslatedKeys) {
      try {
        await delay(150);
        const result = await fakeTranslate(sourceData[key], lang);
        const cleaned = cleanICUPlural(result);
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
    updatedLangs.push(lang);

    console.log(
      translatedCount > 0
        ? `✅ ${translatedCount} new string(s) translated to ${lang}`
        : `ℹ️ No new strings to translate for ${lang}`
    );
  }

  if (updatedLangs.length && !dryRun) {
    updateInitLocalisationCall([SOURCE_LANG, ...updatedLangs], dryRun);
  }
}
