#!/usr/bin/env node
import { runRegistrySubmitCommand } from "./registry-command.js";

runRegistrySubmitCommand(process.argv.slice(2))
  .then(console.log)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
