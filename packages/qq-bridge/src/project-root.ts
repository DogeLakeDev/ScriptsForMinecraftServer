/**
 * project-root.ts — 仓根唯一解析点（DRY/DIP：env / log 勿各自上溯）
 */

import { resolveRuntimeRoot } from "@sfmc-bds/sdk/node/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** SFMC_ROOT > 从本文件向上找 sfmc-monorepo */
export const PROJECT_ROOT: string = resolveRuntimeRoot(HERE);
