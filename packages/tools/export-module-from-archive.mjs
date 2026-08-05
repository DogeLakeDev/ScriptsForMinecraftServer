#!/usr/bin/env node
// @ts-check
/**
 * tools/export-module-from-archive.mjs — 从旁路 sfmc-modules 归档分支导出单包到目标目录
 *
 * 用法:
 *   node tools/export-module-from-archive.mjs economy --out D:/mods/sfmc-module-economy
 *   node tools/export-module-from-archive.mjs economy --out ./tmp-economy --ref archive/monorepo-packages
 *
 * 需要本地存在 ../sfmc-modules（或 SFMC_MODULES_INDEX_ROOT）且含归档 ref。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ROOT as PLATFORM_ROOT } from "./lib/paths.mjs";

/**
 * @param {string} msg
 */
function die(msg, code = 1) {
  console.error(`[export-module] ${msg}`);
  process.exit(code);
}

/**
 * @param {string | any[]} argv
 */
function parseArgs(argv) {
  /** @type {{ out: string | null, ref: string, modulesRoot: string | null }} */
  const flags = { out: null, ref: "archive/monorepo-packages", modulesRoot: null };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") flags.out = argv[++i] ?? null;
    else if (a === "--ref") flags.ref = argv[++i] ?? flags.ref;
    else if (a === "--modules-root") flags.modulesRoot = argv[++i] ?? null;
    else if (a.startsWith("--out=")) flags.out = a.slice("--out=".length);
    else if (a.startsWith("--ref=")) flags.ref = a.slice("--ref=".length);
    else if (a.startsWith("--")) die(`未知参数: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const id = positional[0];
  if (!id || !flags.out) {
    die("用法: export-module-from-archive.mjs <id> --out <目标空目录> [--ref archive/monorepo-packages]");
  }
  const modulesRoot =
    flags.modulesRoot ||
    process.env.SFMC_MODULES_INDEX_ROOT ||
    path.resolve(PLATFORM_ROOT, "..", "sfmc-modules");
  if (!fs.existsSync(path.join(modulesRoot, ".git"))) {
    die(`找不到 sfmc-modules git 仓: ${modulesRoot}`);
  }
  const outAbs = path.resolve(flags.out ?? '');
  fs.mkdirSync(outAbs, { recursive: true });
  if (fs.existsSync(path.join(outAbs, "sapi")) || fs.existsSync(path.join(outAbs, "package.json"))) {
    die(`目标非空（已有模块骨架）: ${outAbs}`);
  }

  const prefix = `packages/${id}`;
  const r = spawnSync(
    "git",
    ["archive", flags.ref, prefix],
    { cwd: modulesRoot, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.status !== 0) {
    die(`git archive 失败: ${(r.stderr && r.stderr.toString()) || `exit ${r.status}`}`);
  }

  /* 解 tar 到临时再把 packages/<id>/* 挪到 out */
  const tmp = fs.mkdtempSync(path.join(path.dirname(outAbs), `sfmc-export-${id}-`));
  try {
    const tar = spawnSync("tar", ["-xf", "-", "-C", tmp], {
      cwd: tmp,
      input: r.stdout,
      encoding: "buffer",
    });
    if (tar.status !== 0) {
      /* Windows 可能无 tar；回退 git checkout */
      const co = spawnSync("git", ["checkout", flags.ref, "--", prefix], { cwd: modulesRoot, encoding: "utf8" });
      if (co.status !== 0) die(`无法解包 archive，且 checkout 失败: ${co.stderr}`);
      const src = path.join(modulesRoot, prefix);
      copyDir(src, outAbs);
      spawnSync("git", ["checkout", "HEAD", "--", prefix], { cwd: modulesRoot });
      spawnSync("git", ["clean", "-fd", prefix], { cwd: modulesRoot });
    } else {
      const src = path.join(tmp, prefix);
      if (!fs.existsSync(src)) die(`archive 中无 ${prefix}`);
      copyDir(src, outAbs);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`[export-module] 已导出 ${id} → ${outAbs}`);
  console.log(`[export-module] 下一步: 对齐 template CI，改 name 为 @sfmc-bds/module-${id}，再 npm publish 并向薄 index 开 PR`);
  console.log(`[export-module] 详见 docs/archive/migrate-official-modules.md`);
}


/**
 * @param {string} src
 * @param {string} dst
 */
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(sp, dp);
    else if (e.isFile()) fs.copyFileSync(sp, dp);
  }
}

main();
