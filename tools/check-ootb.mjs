#!/usr/bin/env node
/**
 * tools/check-ootb.mjs — 开箱自检(平台就绪)
 *
 * 空 catalog / 无业务包 = 合法。不要求内置业务模块。
 *
 * 用法: node tools/check-ootb.mjs
 */
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import {
  ROOT,
  DB_SERVER_DIST,
  SFMC_DIST,
  FETCH_MODULE,
  CONFIGS_DIR,
  CONFIGS_DEFAULT_DIR,
} from "./lib/paths.mjs";
import { exists } from "./lib/io.mjs";
import { requestJson, waitHealth } from "./lib/http.mjs";
import { killProc, runSync } from "./lib/proc.mjs";
import {
  NPM_PUBLISH_PACKAGES,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";

const errors = [];
const passed = [];

function pass(name) {
  passed.push(name);
  console.log(`[ootb] PASS: ${name}`);
}
function fail(name, why) {
  errors.push({ name, why });
  console.error(`[ootb] FAIL: ${name} — ${why}`);
}

async function main() {
  // 0) Node 版本
  {
    const [maj, min] = process.versions.node.split(".").map(Number);
    if (maj > 22 || (maj === 22 && min >= 13)) pass(`Node ${process.versions.node} ≥ 22.13`);
    else fail("Node 版本", `需要 ≥22.13，当前 ${process.versions.node}`);
  }

  // 1) 仓库必需文件(发布包 package.json 从 NPM_PUBLISH_PACKAGES 派生 — DRY)
  {
    const required = [
      ".gitignore",
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      "modules/catalog.json",
      "modules/module-lock.json",
      "tools/fetch-module.mjs",
      "tools/catalog-sync.mjs",
      "tools/check-modules.mjs",
      ...Object.values(NPM_PUBLISH_PACKAGES),
    ];
    const missing = required.filter((f) => !exists(path.join(ROOT, f)));
    if (missing.length === 0) pass("必备仓库文件齐全");
    else fail("必备仓库文件齐全", "缺失: " + missing.join(", "));
  }

  // 1b) npm-publish 清单 ⊆ root workspaces(DRY;防 ba65eb9 tools 发包失败再现)
  {
    try {
      for (const name of Object.keys(NPM_PUBLISH_PACKAGES)) {
        assertPublishPackageInWorkspaces(name, ROOT);
      }
      pass("npm-publish 包均在 workspaces");
    } catch (e) {
      fail("npm-publish 包均在 workspaces", e?.message || String(e));
    }
  }

  // 2) configs: configs/ 或 configs-default/
  {
    const need = ["db_config.json", "bds_updater.json", "qq_config.json"];
    const ok = need.every(
      (n) => exists(path.join(CONFIGS_DIR, n)) || exists(path.join(CONFIGS_DEFAULT_DIR, n))
    );
    if (ok) pass("configs / configs-default 就绪");
    else fail("configs / configs-default 就绪", "缺少 db_config / bds_updater / qq_config");
    if (!exists(path.join(CONFIGS_DIR, "db_config.json"))) {
      console.log("[ootb] WARN: configs/ 未填充，CI/本地可从 configs-default 复制");
    }
  }

  // 3) catalog-sync + check-modules(空 catalog 合法;有已装包则投影入 catalog)
  {
    const sync = runSync(process.execPath, [path.join(ROOT, "tools", "catalog-sync.mjs")], { cwd: ROOT });
    if (sync.status === 0) pass("catalog-sync 通过");
    else fail("catalog-sync 通过", (sync.stderr || sync.stdout || `exit ${sync.status}`).trim());

    const r = runSync(process.execPath, [path.join(ROOT, "tools", "check-modules.mjs")], { cwd: ROOT });
    if (r.status === 0) pass("check-modules 通过");
    else fail("check-modules 通过", (r.stderr || r.stdout || `exit ${r.status}`).trim());
  }

  // 4) SDK dist 提示
  {
    const sdkDist = path.join(ROOT, "modules", "sdk", "@sfmc-sdk", "dist");
    if (exists(sdkDist)) pass("@sfmc-bds/sdk dist 存在");
    else console.log("[ootb] WARN: @sfmc-bds/sdk dist 缺失 — 运行 npm run sdk:build");
  }

  // 5) db-server 启动 + 平台 API(允许 modules=[])
  {
    if (!exists(DB_SERVER_DIST)) {
      fail("db-server 启动 + 平台 API", `缺少 ${DB_SERVER_DIST} — 先 npm run build`);
    } else {
      let dbProc = null;
      try {
        // 若 configs 缺失则用临时 SFMC_ROOT 不够；直接用当前 ROOT
        dbProc = spawn(process.execPath, [DB_SERVER_DIST], {
          cwd: ROOT,
          env: { ...process.env, SFMC_ROOT: ROOT },
          stdio: ["ignore", "pipe", "pipe"],
        });
        const ok = await waitHealth(3001, 15000);
        if (!ok) throw new Error("db-server 不可达 /api/health");
        const health = await requestJson({ port: 3001, method: "GET", path: "/api/health" });
        if (health.status !== 200) throw new Error(`health ${health.status}`);
        const mods = await requestJson({ port: 3001, method: "GET", path: "/api/sfmc/modules" });
        if (mods.status !== 200 || !Array.isArray(mods.body.modules)) {
          throw new Error(`modules 接口异常 ${mods.status}`);
        }
        // configs/all 须含 modules(与 /modules 同源) + module_tokens(SAPI 鉴权注入 — DIP)
        const all = await requestJson({ port: 3001, method: "GET", path: "/api/sfmc/configs/all" });
        if (all.status !== 200 || !Array.isArray(all.body.modules)) {
          throw new Error(`configs/all.modules 异常 ${all.status}`);
        }
        if (!all.body.module_tokens || typeof all.body.module_tokens !== "object") {
          throw new Error("configs/all 缺少 module_tokens");
        }
        // LSP:configs/all.banned_items 须为 string[](与 /banned_items、ConfigManager 同源)
        if (Array.isArray(all.body.banned_items)) {
          const bad = all.body.banned_items.find((x) => typeof x !== "string");
          if (bad !== undefined) {
            throw new Error(`configs/all.banned_items 须为 string[],收到 ${typeof bad}`);
          }
        }
        pass(`db-server 启动 + 平台 API (modules=${mods.body.modules.length})`);
      } catch (e) {
        fail("db-server 启动 + 平台 API", e.message);
      } finally {
        if (dbProc) await killProc(dbProc.pid);
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  // 6) sim-new-user
  {
    const r = runSync(process.execPath, [path.join(ROOT, "tools", "sim-new-user.mjs")], {
      cwd: ROOT,
      timeout: 90000,
    });
    if (r.status === 0) pass("sim-new-user 通过");
    else fail("sim-new-user 通过", (r.stderr || r.stdout || `exit ${r.status}`).trim().slice(0, 500));
  }

  // 7) sfmc CLI
  {
    if (!exists(SFMC_DIST)) {
      console.log("[ootb] WARN: sfmc/dist/main.js 缺失 — 跳过 CLI 检查");
    } else {
      const r = runSync(process.execPath, [SFMC_DIST, "--help"], { cwd: ROOT });
      /* 剥离 ANSI;接受 module list / module/mod list / module|mod list
       * (与 MODULE_CMD_NAMES / HELP 展示对齐,避免别名改动再次打红) */
      const helpText = (r.stdout + r.stderr).replace(/\u001b\[[0-9;]*m/g, "");
      const hasModule = /module(?:\s*[|/]\s*mod)?\s+(list|install)\b/.test(helpText);
      if (r.status === 0 && hasModule) pass("sfmc CLI module 子命令已注册");
      else fail("sfmc CLI module 子命令已注册", helpText.trim().slice(0, 800));
    }
  }

  // 8) fetch-module 可执行(help)
  {
    const r = runSync(process.execPath, [FETCH_MODULE], { cwd: ROOT });
    if (r.status === 0 && /install/.test(r.stdout)) pass("fetch-module 可执行");
    else fail("fetch-module 可执行", (r.stderr || r.stdout || `exit ${r.status}`).trim());
  }

  console.log(`\n[ootb] 通过 ${passed.length} / 失败 ${errors.length}`);
  if (errors.length > 0) {
    console.error(`\n[ootb] 失败项目:`);
    for (const e of errors) console.error(`  - ${e.name}: ${e.why}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[ootb] ERROR:", e);
  process.exit(1);
});
