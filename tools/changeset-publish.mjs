#!/usr/bin/env node
/**
 * changeset publish 包装：
 * - 跳过 lifecycle scripts（CI 已先 build；避免多包并行 prepublishOnly 抢 tsc7）
 * - pre mode 下由 changesets 自动使用 pre.json 的 tag（勿再传 --tag，会报错）
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prePath = path.join(root, ".changeset", "pre.json");

let preTag = null;
if (fs.existsSync(prePath)) {
  const pre = JSON.parse(fs.readFileSync(prePath, "utf8"));
  if (pre.mode === "pre" && pre.tag) preTag = String(pre.tag);
}

const env = {
  ...process.env,
  /* 跳过 prepublishOnly / prepare，避免并行 dts 竞态 */
  npm_config_ignore_scripts: "true",
};

const args = ["changeset", "publish"];
/* 仅非 pre 时允许显式 --tag；pre mode 会自行打到 pre.json#tag */
if (!preTag && process.env.SFMC_PUBLISH_TAG) {
  args.push("--tag", process.env.SFMC_PUBLISH_TAG);
}

console.log(
  `[changeset-publish] running: npx ${args.join(" ")}` +
    (preTag ? ` (pre mode → npm tag ${preTag})` : "")
);
const r = spawnSync("npx", args, { cwd: root, env, stdio: "inherit", shell: true });
process.exit(r.status === null ? 1 : r.status);
