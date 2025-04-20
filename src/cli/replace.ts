import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import * as babel from "@babel/core";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

const ignoreFile = ".localiseignore";

function getIgnoredPaths(): string[] {
  if (!fs.existsSync(ignoreFile)) return [];
  return fs.readFileSync(ignoreFile, "utf-8").split("\n").filter(Boolean);
}

function hasUseTImport(ast: t.File): boolean {
  return ast.program.body.some(
    (node) =>
      t.isImportDeclaration(node) &&
      node.source.value === "localise-ai" &&
      node.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          specifier.imported.name === "useT"
      )
  );
}

function hasUseTVariable(ast: t.File): boolean {
  let found = false;
  traverse(ast, {
    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id, { name: "t" }) &&
        t.isCallExpression(path.node.init) &&
        t.isIdentifier(path.node.init.callee, { name: "useT" })
      ) {
        found = true;
        path.stop();
      }
    },
  });
  return found;
}

function insertUseT(ast: t.File) {
  const useTVarDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.identifier("t"),
      t.callExpression(t.identifier("useT"), [])
    ),
  ]);

  if (!hasUseTImport(ast)) {
    const importDecl = t.importDeclaration(
      [t.importSpecifier(t.identifier("useT"), t.identifier("useT"))],
      t.stringLiteral("localise-ai")
    );
    ast.program.body.unshift(importDecl);
  }

  if (!hasUseTVariable(ast)) {
    traverse(ast, {
      FunctionDeclaration(path) {
        if (t.isBlockStatement(path.node.body)) {
          path.node.body.body.unshift(useTVarDecl);
          path.stop();
        }
      },
      ArrowFunctionExpression(path) {
        if (
          t.isVariableDeclarator(path.parent) &&
          t.isVariableDeclaration(path.parentPath.parent)
        ) {
          const block = path.node.body;
          if (t.isBlockStatement(block)) {
            block.body.unshift(useTVarDecl);
            path.stop();
          }
        }
      },
      ClassMethod(path) {
        if (
          path.node.kind === "method" &&
          t.isIdentifier(path.node.key, { name: "render" }) &&
          t.isBlockStatement(path.node.body)
        ) {
          path.node.body.body.unshift(useTVarDecl);
          path.stop();
        }
      },
    });
  }
}

function getKeyPrefix(filePath: string): string {
  const cleaned = filePath
    .replace(/^.*\/app\//, "")
    .replace(/\.[jt]sx?$/, "")
    .replace(/\//g, ".");
  return cleaned || "unknown";
}

function replaceStrings(
  ast: t.File,
  filePath: string,
  seenKeys: Set<string>,
  translations: Record<string, string>
): boolean {
  let changed = false;
  let index = 1;
  const prefix = getKeyPrefix(filePath);

  traverse(ast, {
    JSXText(path) {
      const raw = path.node.value.trim();
      if (!raw) return;

      const key = `${prefix}.text_${index++}`;
      if (seenKeys.has(key)) return;

      const expr = t.jsxExpressionContainer(
        t.callExpression(t.identifier("t"), [t.stringLiteral(key)])
      );
      path.replaceWith(expr);
      seenKeys.add(key);
      translations[key] = raw;
      changed = true;
    },

    JSXAttribute(path) {
      if (
        t.isJSXIdentifier(path.node.name) &&
        t.isStringLiteral(path.node.value)
      ) {
        const name = path.node.name.name;
        const raw = path.node.value.value.trim();
        if (!raw || ["style", "type", "name", "href"].includes(name)) return;

        const key = `${prefix}.text_${index++}`;
        if (seenKeys.has(key)) return;

        path.node.value = t.jsxExpressionContainer(
          t.callExpression(t.identifier("t"), [t.stringLiteral(key)])
        );
        seenKeys.add(key);
        translations[key] = raw;
        changed = true;
      }
    },

    ConditionalExpression(path) {
      const { test, consequent, alternate } = path.node;

      if (
        t.isStringLiteral(consequent) &&
        t.isStringLiteral(alternate) &&
        t.isBinaryExpression(test) &&
        (test.operator === "===" || test.operator === "==") &&
        (t.isIdentifier(test.left) ||
          t.isMemberExpression(test.left) ||
          t.isNumericLiteral(test.left))
      ) {
        const one = consequent.value.trim();
        const other = alternate.value.trim();
        const key = `${prefix}.plural_${index++}`;
        if (seenKeys.has(key)) return;

        const pluralExpr = t.callExpression(t.identifier("t"), [
          t.stringLiteral(key),
          t.objectExpression([
            t.objectProperty(t.identifier("count"), test.left),
          ]),
        ]);

        path.replaceWith(pluralExpr);
        seenKeys.add(key);
        translations[key] = `{count, plural, one {${one}} other {${other}}}`;
        changed = true;
      }
    },
  });

  return changed;
}

function findRootComponent(): string | null {
  const potentialFiles = [
    "app/_layout.tsx",
    "app/_layout.jsx",
    "app/index.tsx",
    "app/index.jsx",
  ];

  for (const file of potentialFiles) {
    if (fs.existsSync(file)) {
      return file;
    }
  }

  return null;
}

function injectInitLocalisation() {
  const rootFile = findRootComponent();
  if (!rootFile) {
    console.log("❌ Could not find root layout file.");
    return;
  }

  const translationsDir = "translations";
  const files = fs.readdirSync(translationsDir);
  const locales = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"));

  const defaultLocale = "en";

  const code = fs.readFileSync(rootFile, "utf-8");

  if (code.includes("initLocalisation(")) {
    console.log("ℹ️ initLocalisation already present in root file.");
    return;
  }

  const ast = babel.parseSync(code, {
    sourceType: "module",
    plugins: [
      ["@babel/plugin-transform-typescript", { isTSX: true }],
      "@babel/plugin-transform-react-jsx",
    ],
  }) as t.File;

  // Add all `import xx from "../translations/xx.json";`
  const localeImports = locales.map((locale) =>
    t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(locale))],
      t.stringLiteral(`../translations/${locale}.json`)
    )
  );

  // Add `initLocalisation("en", { en, fr, de });`
  const initCall = t.expressionStatement(
    t.callExpression(t.identifier("initLocalisation"), [
      t.stringLiteral(defaultLocale),
      t.objectExpression(
        locales.map((locale) =>
          t.objectProperty(
            t.identifier(locale),
            t.identifier(locale),
            false,
            true
          )
        )
      ),
    ])
  );

  // Insert imports after existing imports
  const lastImportIndex = ast.program.body.findIndex(
    (n) => !t.isImportDeclaration(n)
  );
  ast.program.body.splice(lastImportIndex, 0, ...localeImports);

  // Insert initLocalisation after imports
  ast.program.body.splice(lastImportIndex + localeImports.length, 0, initCall);

  // Add import for initLocalisation if needed
  const hasImport = ast.program.body.some(
    (n) =>
      t.isImportDeclaration(n) &&
      n.source.value === "localise-ai" &&
      n.specifiers.some(
        (s) =>
          t.isImportSpecifier(s) &&
          t.isIdentifier(s.imported, { name: "initLocalisation" })
      )
  );

  if (!hasImport) {
    ast.program.body.unshift(
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("initLocalisation"),
            t.identifier("initLocalisation")
          ),
        ],
        t.stringLiteral("localise-ai")
      )
    );
  }

  const output = generate(ast, {}, code).code;
  fs.writeFileSync(rootFile, output);
  console.log(`📥 Injected initLocalisation into ${rootFile}`);
}

export async function runReplace({ dryRun = false }: { dryRun?: boolean }) {
  const defaultLang = "en";
  const translationsDir = "translations";
  const enFilePath = path.join(translationsDir, `${defaultLang}.json`);

  if (!fs.existsSync(translationsDir)) fs.mkdirSync(translationsDir);
  if (!fs.existsSync(enFilePath)) {
    fs.writeJsonSync(enFilePath, {}, { spaces: 2 });
    console.log("📁 Created translations/en.json");
  }

  const existing = fs.readJsonSync(enFilePath);
  const translations: Record<string, string> = { ...existing };
  const seenKeys = new Set(Object.keys(translations));

  const ignored = getIgnoredPaths();
  const files = glob.sync("**/*.{js,jsx,ts,tsx}", {
    ignore: ["node_modules/**", "dist/**", ...ignored],
  });

  let updatedCount = 0;

  for (const file of files) {
    const code = fs.readFileSync(file, "utf-8");
    const ast = babel.parseSync(code, {
      sourceType: "module",
      plugins: [
        ["@babel/plugin-transform-typescript", { isTSX: true }],
        "@babel/plugin-transform-react-jsx",
      ],
    }) as t.File;

    if (!ast) continue;

    const didReplace = replaceStrings(ast, file, seenKeys, translations);

    if (didReplace) {
      insertUseT(ast);
      const output = generate(ast, {}, code).code;

      if (dryRun) {
        console.log(`🧪 Would update: ${file}`);
      } else {
        fs.writeFileSync(file, output);
        console.log(`✅ Updated: ${file}`);
      }

      updatedCount++;
    }
  }

  fs.writeJsonSync(enFilePath, translations, { spaces: 2 });

  if (!dryRun) {
    injectInitLocalisation();
  }

  if (updatedCount === 0) {
    console.log("ℹ️ No hardcoded strings found to replace.");
  }
}
