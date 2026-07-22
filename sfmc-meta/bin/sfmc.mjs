#!/usr/bin/env node
/**
 * @sfmc-bds/sfmc entry — resolve platform packages from this meta-package's
 * dependency tree, set SFMC_ROOT to cwd, then hand off to @sfmc-bds/cli.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function resolved(specifier) {
  return fileURLToPath(import.meta.resolve(specifier));
}

/* Data/config root = cwd unless caller already set SFMC_ROOT (SEA / isolation). */
if (!process.env.SFMC_ROOT) {
  process.env.SFMC_ROOT = process.cwd();
}

/* Inject absolute service entry paths so CLI does not need monorepo layout. */
process.env.SFMC_SERVICE_DB_ENTRY ??= resolved("@sfmc-bds/db-server");
process.env.SFMC_SERVICE_QQ_ENTRY ??= resolved("@sfmc-bds/qq-bridge");
process.env.SFMC_SERVICE_UPDATE_ENTRY ??= resolved("@sfmc-bds/bds-tools/check-update");
process.env.SFMC_SERVICE_MANAGER_ENTRY ??= resolved("@sfmc-bds/bds-tools/bds-manager");
process.env.SFMC_SERVICE_PACK_MANAGER_ENTRY ??= resolved("@sfmc-bds/bds-tools/pack-manager");
process.env.SFMC_FETCH_MODULE ??= resolved("@sfmc-bds/tools/fetch-module.mjs");
process.env.SFMC_DEFAULTS_DIR ??= path.join(here, "..", "defaults");

await import(import.meta.resolve("@sfmc-bds/cli/cli"));
