#!/usr/bin/env node
// @ts-check
/**
 * 生成 @sfmc-bds/sdk 的 TypeDoc Markdown → docs/zh/reference/sdk/
 * 并复制到 docs/en/reference/sdk/
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { ROOT as root } from "./lib/paths.mjs";

const zhOut = path.join(root, "docs", "zh", "reference", "sdk");
const enOut = path.join(root, "docs", "en", "reference", "sdk");

/**
 * @param {string} cmd
 * @param {readonly string[]} args
 */
function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

/** @param {string} dir */
function writeMetaFromDirs(dir) {
  const dirs = readdirSync(dir).filter((name) => {
    try {
      return statSync(path.join(dir, name)).isDirectory();
    } catch {
      return false;
    }
  });
  writeFileSync(
    path.join(dir, "_meta.json"),
    JSON.stringify(
      [
        "index",
        ...dirs.map((name) => ({
          type: "dir",
          name,
          label: name,
        })),
      ],
      null,
      2
    ) + "\n",
    "utf8"
  );
}

console.log("[docs-typedoc] generating @sfmc-bds/sdk → docs/zh/reference/sdk/");
const typedocBin = path.join(root, "node_modules", "typedoc", "bin", "typedoc");
run(process.execPath, [typedocBin, "--options", "typedoc.json"]);

mkdirSync(zhOut, { recursive: true });
writeMetaFromDirs(zhOut);

if (!existsSync(path.join(zhOut, "index.md"))) {
  console.error("[docs-typedoc] ERROR: index.md was not generated");
  process.exit(1);
}

mkdirSync(path.dirname(enOut), { recursive: true });
rmSync(enOut, { recursive: true, force: true });
cpSync(zhOut, enOut, { recursive: true });

console.log("[docs-typedoc] done (+ synced en/reference/sdk)");
