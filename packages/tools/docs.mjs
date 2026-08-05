#!/usr/bin/env node
// @ts-check
/**
 * 文档统一入口（Rspress）
 *
 *   node packages/tools/docs.mjs api     # 仅 TypeDoc
 *   node packages/tools/docs.mjs build   # TypeDoc + rspress build
 *   node packages/tools/docs.mjs serve   # TypeDoc + rspress dev
 *
 * Windows 仓路径若含 `#`，Rspack 会把 `#` 当成 loader query 分隔符。
 * 此时把 docs/website 镜像到 %TEMP%/sfmc-rspress-build（物理拷贝 node_modules）再构建。
 */
import { cpSync, existsSync, mkdirSync, rmSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { ROOT, TOOLS_PKG_DIR } from "./lib/paths.mjs";

const cmd = process.argv[2];

if (!cmd || !["api", "build", "serve"].includes(cmd)) {
  console.error("用法: node packages/tools/docs.mjs <api|build|serve>");
  process.exit(2);
}

function runTypedoc() {
  const skip =
    process.env.SFMC_DOCS_SKIP_TYPEDOC === "1" ||
    (cmd === "serve" &&
      process.env.SFMC_DOCS_FORCE_TYPEDOC !== "1" &&
      existsSync(path.join(ROOT, "docs", "zh", "reference", "sdk", "index.md")));
  if (skip) {
    console.log(
      "[docs] 跳过 TypeDoc（已有 docs/zh/reference/sdk；强制生成设 SFMC_DOCS_FORCE_TYPEDOC=1）"
    );
    return;
  }
  const r = spawnSync(
    process.execPath,
    [path.join(TOOLS_PKG_DIR, "docs-typedoc.mjs")],
    { cwd: ROOT, stdio: "inherit", env: process.env }
  );
  if (r.error) throw r.error;
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

/** @param {string} root */
function needsCleanRoot(root) {
  return /[#?]/.test(root);
}

/**
 * @param {string} from
 * @param {string} to
 */
function syncTree(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return !(base === "node_modules" || base === ".rspress" || base === "doc_build");
    },
  });
}

/**
 * @returns {string}
 */
function prepareRoot() {
  if (!needsCleanRoot(ROOT)) return ROOT;
  const mirror = path.join(os.tmpdir(), "sfmc-rspress-build");
  console.log(`[docs] 仓路径含 #/?，镜像构建目录: ${mirror}`);
  mkdirSync(mirror, { recursive: true });

  // docs 全量同步；website 用 cpSync 且跳过 node_modules，保留镜像内已有依赖
  syncTree(path.join(ROOT, "docs"), path.join(mirror, "docs"));
  const websiteMirror = path.join(mirror, "website");
  const nmDest = path.join(websiteMirror, "node_modules");
  mkdirSync(websiteMirror, { recursive: true });
  cpSync(path.join(ROOT, "website"), websiteMirror, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return !(base === "node_modules" || base === ".rspress" || base === "doc_build");
    },
  });

  const nmSrc = path.join(ROOT, "website", "node_modules");
  const needNm =
    !existsSync(nmDest) ||
    !existsSync(path.join(nmDest, "rspress-plugin-mermaid")) ||
    !existsSync(path.join(nmDest, "@rspress", "core"));
  if (needNm) {
    console.log("[docs] 同步 website/node_modules → 镜像（缺依赖时全量拷贝）…");
    const rc = spawnSync(
      "robocopy",
      [nmSrc, nmDest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"],
      { stdio: "inherit", shell: true }
    );
    if ((rc.status ?? 16) >= 8) {
      console.error("[docs] robocopy node_modules 失败", rc.status);
      process.exit(1);
    }
  } else {
    console.log("[docs] 复用镜像内已有 node_modules");
  }

  for (const f of ["i18n.json", "typedoc.json", "package.json", "package-lock.json"]) {
    const src = path.join(ROOT, f);
    if (existsSync(src)) cpSync(src, path.join(mirror, f));
  }

  return mirror;
}

/**
 * @param {string} effectiveRoot
 * @param {string[]} args
 */
function runRspress(effectiveRoot, args) {
  const websiteDir = path.join(effectiveRoot, "website");
  const rspressBin = path.join(
    websiteDir,
    "node_modules",
    "@rspress",
    "core",
    "bin",
    "rspress.js"
  );
  if (!existsSync(rspressBin)) {
    console.error("[docs] 请先在 website/ 执行 npm install");
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [rspressBin, ...args], {
    cwd: websiteDir,
    stdio: "inherit",
    env: {
      ...process.env,
      SFMC_DOCS_ROOT: effectiveRoot,
    },
  });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

runTypedoc();

if (cmd === "api") {
  process.exit(0);
}

const effectiveRoot = prepareRoot();
const status = runRspress(effectiveRoot, [cmd === "serve" ? "dev" : "build"]);

if (cmd === "build" && effectiveRoot !== ROOT && status === 0) {
  const built = path.join(effectiveRoot, "doc_build");
  const dest = path.join(ROOT, "doc_build");
  if (existsSync(built)) {
    rmSync(dest, { recursive: true, force: true });
    cpSync(built, dest, { recursive: true });
    console.log(`[docs] 已将 doc_build 拷回 ${dest}`);
  }
  const reg = path.join(effectiveRoot, "website", "generated", "module-registry.json");
  if (existsSync(reg)) {
    mkdirSync(path.join(ROOT, "website", "generated"), { recursive: true });
    cpSync(reg, path.join(ROOT, "website", "generated", "module-registry.json"));
  }
}

process.exit(status);
