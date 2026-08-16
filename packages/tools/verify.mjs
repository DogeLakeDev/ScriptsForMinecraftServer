#!/usr/bin/env node
// @ts-check
/**
 * tools/verify.mjs — 平台集成自检（主仓唯一 CI 门禁）
 *
 * 主仓默认无业务模块：不测 catalog-sync；已装包时 check-modules 校验 catalog 一致性。
 * 一次 db 生命周期覆盖平台 API + 模块 REST（有模块时才 enable/disable）。
 *
 * 用法:
 *   node packages/tools/verify.mjs              # 全量（离线 + db + 隔离 SFMC_ROOT）
 *   node packages/tools/verify.mjs --offline    # 仅离线
 *   node packages/tools/verify.mjs --skip-isolated
 */
import process from "node:process";
import { createReporter } from "./lib/verify/reporter.mjs";
import { runOfflinePhase } from "./lib/verify/offline.mjs";
import { withDbServer } from "./lib/verify/db-harness.mjs";
import { assertModuleRestApi, assertPlatformDbApi } from "./lib/verify/db-api.mjs";
import { runIsolatedRootSimulation } from "./lib/verify/isolated-root.mjs";
import { ROOT } from "./lib/paths.mjs";

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  return {
    offlineOnly: argv.includes("--offline"),
    skipIsolated: argv.includes("--skip-isolated"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`用法: node packages/tools/verify.mjs [选项]

选项:
  --offline         仅离线检查（Node、文件、schema、configs、check-modules、CLI）
  --skip-isolated   跳过隔离 SFMC_ROOT 模拟
  -h, --help        显示帮助

等价旧命令: check-ootb / smoke-modules / sim-new-user（已合并）`);
}

/**
 * @param {string[]} [argv]
 */
export async function runVerify(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp();
    return 0;
  }

  const reporter = createReporter("verify");

  runOfflinePhase(reporter);
  if (opts.offlineOnly) {
    reporter.printSummary();
    return reporter.ok ? 0 : 1;
  }

  if (reporter.ok) {
    try {
      await withDbServer({ dataRoot: ROOT }, async (port) => {
        const platform = await assertPlatformDbApi(port);
        reporter.pass(`db-server 平台 API (modules=${platform.moduleCount})`);

        const modules = await assertModuleRestApi(port);
        if (modules.moduleCount === 0) {
          reporter.pass("模块 REST（空 catalog，跳过启停翻转）");
        } else if (modules.toggled) {
          reporter.pass(`模块 REST + enable/disable (${modules.moduleCount} 模块)`);
        } else {
          reporter.pass(`模块 REST (${modules.moduleCount} 模块，无 can_disable 可翻转)`);
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      reporter.fail("db-server 集成", message);
    }
  } else {
    reporter.warn("离线阶段已有失败 — 跳过 db-server 集成");
  }

  if (!opts.skipIsolated && reporter.ok) {
    try {
      await runIsolatedRootSimulation();
      reporter.pass("隔离 SFMC_ROOT 模拟");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      reporter.fail("隔离 SFMC_ROOT 模拟", message);
    }
  }

  reporter.printSummary();
  return reporter.ok ? 0 : 1;
}

async function main() {
  const code = await runVerify();
  process.exit(code);
}

main().catch((e) => {
  console.error("[verify] ERROR:", e);
  process.exit(1);
});
