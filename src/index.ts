#!/usr/bin/env node

import { Command } from "commander";
import { runInit } from "./commands/init";
import { runReplace } from "./commands/replace";
import { runTranslateCommand } from "./commands/translate";

const program = new Command();

program
  .name("localise")
  .description("AI-powered React Native localisation CLI")
  .version("0.1.0");

// localise init
program
  .command("init")
  .description("Initialise the localisation config")
  .action(runInit);

// localise replace
program
  .command("replace")
  .description("Extract and replace hardcoded strings with `t()`")
  .action(() => {
    runReplace();
  });

// localise translate --lang fr,de
program
  .command("translate")
  .description("Translate extracted strings")
  .requiredOption(
    "--lang <languages>",
    "Comma-separated list of target languages"
  )
  .option("--dry-run", "Preview translation changes without saving")
  .action((options) => {
    runTranslateCommand(options.lang.split(","), options.dryRun);
  });

program.parse(process.argv);
