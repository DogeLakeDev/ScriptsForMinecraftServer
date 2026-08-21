// @ts-check
/**
 * 离线阶段：Node、仓库文件、schema、configs 播种、CLI / fetch-module 冒烟
 *
 * 主仓默认无业务模块 — 不做 catalog-sync / check-modules。
 */
import path from "node:path";
import process from "node:process";
import { NPM_PUBLISH_PACKAGES, assertPublishPackageInWorkspaces } from "../npm-publish-packages.mjs";
import { exists } from "../io.mjs";
import {
  FETCH_MODULE,
  ROOT,
  SFMC_DIST,
} from "../paths.mjs";
import { runSync } from "../proc.mjs";
import { coreConfigsReady, seedCoreConfigs } from "./seed-configs.mjs";

const SCHEMA_FILES = [
  "db_config.schema.json",
  "qq_config.schema.json",
  "bds_updater.schema.json",
  "pack_update.schema.json",
  "pack_sources.schema.json",
  "permissions.schema.json",
  "module_catalog.schema.json",
];

/**
 * @param {ReturnType<import("./reporter.mjs").createReporter>} reporter
 */
export function runOfflinePhase(reporter) {
  {
    const [maj, min] = process.versions.node.split(".").map(Number);
    if (maj > 22 || (maj === 22 && min >= 13)) {
      reporter.pass(`Node ${process.versions.node} ≥ 22.13`);
    } else {
      reporter.fail("Node 版本", `需要 ≥22.13，当前 ${process.versions.node}`);
    }
  }

  {
    const required = [
      ".gitignore",
      "AGENTS.md",
      "README.md",
      "modules/catalog.json",
      "packages/tools/verify.mjs",
      "packages/cli/scripts/module-install/fetch-module.mjs",
      ...Object.values(NPM_PUBLISH_PACKAGES),
    ];
    const missing = required.filter((f) => !exists(path.join(ROOT, f)));
    if (missing.length === 0) reporter.pass("必备仓库文件齐全");
    else reporter.fail("必备仓库文件齐全", "缺失: " + missing.join(", "));
  }

  {
    try {
      for (const name of Object.keys(NPM_PUBLISH_PACKAGES)) {
        assertPublishPackageInWorkspaces(name, ROOT);
      }
      reporter.pass("npm-publish 包均在 workspaces");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      reporter.fail("npm-publish 包均在 workspaces", message || String(e));
    }
  }

  {
    const schemaDir = path.join(ROOT, "modules", "sdk", "@sfmc-sdk", "schemas");
    const missing = SCHEMA_FILES.filter((n) => !exists(path.join(schemaDir, n)));
    if (missing.length === 0) reporter.pass("配置 JSON Schema 齐全");
    else reporter.fail("配置 JSON Schema 齐全", "缺失: " + missing.join(", "));
  }

  {
    const seeded = seedCoreConfigs(ROOT);
    if (seeded.ok) reporter.pass("核心 configs 已播种");
    else reporter.fail("核心 configs 已播种", seeded.error);

    const ready = coreConfigsReady(ROOT);
    if (ready.ok) reporter.pass("configs/ 核心文件齐全");
    else reporter.fail("configs/ 核心文件齐全", ready.error);
  }

  {
    const sdkDist = path.join(ROOT, "modules", "sdk", "@sfmc-sdk", "dist");
    if (exists(sdkDist)) reporter.pass("@sfmc-bds/sdk dist 存在");
    else reporter.warn("@sfmc-bds/sdk dist 缺失 — 运行 npm run build -w @sfmc-bds/sdk");
  }

  {
    if (!exists(SFMC_DIST)) {
      reporter.warn("packages/cli/dist/main.js 缺失 — 跳过 CLI 检查");
    } else {
      const r = runSync(process.execPath, [SFMC_DIST, "--help"], { cwd: ROOT });
      const helpText = (r.stdout + r.stderr).replace(/\u001b\[[0-9;]*m/g, "");
      const hasModule = /module(?:\s*[|/]\s*mod)?\s+(list|install)\b/.test(helpText);
      if (r.status === 0 && hasModule) reporter.pass("sfmc CLI module 子命令已注册");
      else reporter.fail("sfmc CLI module 子命令已注册", helpText.trim().slice(0, 800));
    }
  }

  {
    const r = runSync(process.execPath, [FETCH_MODULE], { cwd: ROOT });
    if (r.status === 0 && /install/.test(r.stdout)) reporter.pass("fetch-module 可执行");
    else reporter.fail("fetch-module 可执行", (r.stderr || r.stdout || `exit ${r.status}`).trim());
  }
}
