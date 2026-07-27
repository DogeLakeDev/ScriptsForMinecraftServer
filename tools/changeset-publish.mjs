#!/usr/bin/env node
/**
 * changeset publish 包装：
 * - 跳过 lifecycle scripts（CI 已先 build；避免多包并行 prepublishOnly 抢 tsc7）
 * - pre mode 下由 changesets 自动使用 pre.json 的 tag（勿再传 --tag，会报错）
 */
import { spawnSync } from "node:child_process";
import { ROOT, isPreMode, readPreState } from "./changeset-release-lib.mjs";

const pre = readPreState();
const preTag = isPreMode() && pre?.tag ? String(pre.tag) : null;

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
const r = spawnSync("npx", args, { cwd: ROOT, env, stdio: "inherit", shell: true });
process.exit(r.status === null ? 1 : r.status);
