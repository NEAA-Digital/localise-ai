#!/usr/bin/env node

import { Command } from "commander";
import { runInit } from "./cli/init";
import { runReplace } from "./cli/replace";
import { runTranslateCommand } from "./cli/translate";

// SDK exports – make them available for import in RN apps
export {
  useT,
  setLocale,
  getCurrentLocale,
  getTranslations,
  getAvailableLocales,
} from "./sdk";

const program = new Command();

program
  .name("localise-ai")
  .description("AI-powered localisation CLI for React Native")
  .version("1.0.0");

program
  .command("init")
  .description("Initialise the localisation config")
  .action(runInit);

program
  .command("replace")
  .description("Extract and replace hardcoded strings with t()")
  .option("--dry-run", "Preview changes without writing to files")
  .action(runReplace);

program
  .command("translate")
  .description("Translate strings in your translations folder")
  .requiredOption("--lang <languages>", "Comma-separated list of languages")
  .option("--dry-run", "Preview translation changes without saving")
  .action((opts) => {
    const langs = opts.lang.split(",").map((l: string) => l.trim());
    runTranslateCommand(langs, opts.dryRun);
  });

if (require.main === module) {
  program.parse(process.argv);
}
