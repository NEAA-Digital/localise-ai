//
import path from "path";
export function getTranslationKeyPrefix(filePath: string): string {
  // Get relative path from src/
  const relative = path.relative("src", filePath);

  // Remove file extension
  const noExt = relative.replace(/\.[tj]sx?$/, "");

  // Convert slashes to dots & kebab-case segments
  const parts = noExt.split(path.sep).map((segment) =>
    segment
      .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase → camel_case
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
  );

  return parts.join(".");
}
