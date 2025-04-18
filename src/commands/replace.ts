import fs from "fs-extra";
import path from "path";
import { globSync } from "glob";
import { minimatch } from "minimatch";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import prettier from "prettier";

const TRANSLATION_FILE = path.join("translations", "en.json");

function getIgnoredGlobs(): string[] {
  const ignorePath = path.resolve(".localiseignore");
  if (!fs.existsSync(ignorePath)) return [];

  const lines = fs
    .readFileSync(ignorePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return lines;
}

function generateKeyFromFilePath(filePath: string, index: number): string {
  const relativePath = path
    .relative("src", filePath)
    .replace(/\.[jt]sx?$/, "")
    .replace(/[\\/]/g, ".")
    .toLowerCase();
  return `${relativePath}.text_${index}`;
}

export async function runReplace({ dryRun = false } = {}) {
  console.log(
    `🔁 ${dryRun ? "Dry run:" : ""} Extracting and replacing translatable text...`
  );

  const translations: Record<string, string> = fs.existsSync(TRANSLATION_FILE)
    ? fs.readJSONSync(TRANSLATION_FILE)
    : {};

  const textToKey = Object.entries(translations).reduce(
    (acc, [key, value]) => {
      acc[value.trim()] = key;
      return acc;
    },
    {} as Record<string, string>
  );

  let keyCounter = Object.keys(translations).length + 1;

  const ignorePatterns = getIgnoredGlobs();
  const allFiles = globSync("src/**/*.{js,ts,tsx}", {
    ignore: ["**/node_modules/**"],
    absolute: true,
  });

  const files = allFiles.filter(
    (file) =>
      !ignorePatterns.some((pattern) =>
        minimatch(file, pattern, { matchBase: true })
      )
  );

  let updatedFiles = 0;

  for (const filePath of files) {
    const code = fs.readFileSync(filePath, "utf-8");
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    let modified = false;
    let usedTFunction = false;

    traverse(ast, {
      JSXText(path) {
        const raw = path.node.value.trim();
        if (!raw || !/[a-zA-Z]/.test(raw)) return;

        let key = textToKey[raw];
        if (!key) {
          key = generateKeyFromFilePath(filePath, keyCounter++);
          translations[key] = raw;
          textToKey[raw] = key;
        }

        path.replaceWith(
          t.jsxExpressionContainer(
            t.callExpression(t.identifier("t"), [t.stringLiteral(key)])
          )
        );
        usedTFunction = true;
        modified = true;
      },

      JSXExpressionContainer(path) {
        const expr = path.node.expression;

        // Check for t("key") usage
        if (
          t.isCallExpression(expr) &&
          t.isIdentifier(expr.callee, { name: "t" }) &&
          expr.arguments.length > 0 &&
          t.isStringLiteral(expr.arguments[0])
        ) {
          const key = expr.arguments[0].value;
          if (!translations[key]) {
            console.warn(
              `⚠️  t("${key}") used in ${filePath} but not found in translations.`
            );
          }
        }

        // Template literal handling
        if (!t.isTemplateLiteral(expr)) return;

        const stringParts: string[] = [];
        const variableNames: string[] = [];

        expr.quasis.forEach((q, i) => {
          stringParts.push(q.value.cooked || "");
          if (expr.expressions[i]) {
            const v = expr.expressions[i];
            if (t.isIdentifier(v)) {
              const name = v.name;
              stringParts.push(`{{${name}}}`);
              variableNames.push(name);
            }
          }
        });

        const rawText = stringParts.join("").trim();
        if (!rawText || !/[a-zA-Z]/.test(rawText)) return;

        let key = textToKey[rawText];
        if (!key) {
          key = generateKeyFromFilePath(filePath, keyCounter++);
          translations[key] = rawText;
          textToKey[rawText] = key;
        }

        const props = variableNames.map((name) =>
          t.objectProperty(t.identifier(name), t.identifier(name))
        );

        const args: t.Expression[] = [t.stringLiteral(key)];
        if (props.length > 0) {
          args.push(t.objectExpression(props));
        }

        path.replaceWith(
          t.jsxExpressionContainer(t.callExpression(t.identifier("t"), args))
        );

        usedTFunction = true;
        modified = true;
      },
    });

    if (usedTFunction) {
      const hasTImport = ast.program.body.some(
        (node) =>
          t.isImportDeclaration(node) &&
          node.source.value === "localise-ai-sdk" &&
          node.specifiers.some(
            (s) =>
              t.isImportSpecifier(s) &&
              t.isIdentifier(s.imported) &&
              s.imported.name === "t"
          )
      );

      if (!hasTImport) {
        const tImport = t.importDeclaration(
          [t.importSpecifier(t.identifier("t"), t.identifier("t"))],
          t.stringLiteral("localise-ai-sdk")
        );
        ast.program.body.unshift(tImport);
        modified = true;
      }
    }

    if (modified) {
      updatedFiles++;
      const output = generate(ast, { retainLines: true }).code;
      const formatted = await prettier.format(output, { parser: "babel-ts" });

      if (dryRun) {
        console.log(`🧪 Would update: ${filePath}`);
      } else {
        fs.writeFileSync(filePath, formatted, "utf-8");
        console.log(`✅ Updated: ${filePath}`);
      }
    }
  }

  if (!dryRun) {
    fs.ensureDirSync("translations");
    fs.writeJSONSync(TRANSLATION_FILE, translations, { spaces: 2 });
  }

  console.log(
    dryRun
      ? `🧪 Dry run complete. ${updatedFiles} files would be updated.`
      : `🎉 Replacement complete. ${updatedFiles} files updated.`
  );
}
