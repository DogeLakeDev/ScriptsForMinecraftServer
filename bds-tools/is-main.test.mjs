/**
 * is-main 契约测试：直接入口 / shim 入口 / 被异名入口 import
 * 运行: npm test -w @sfmc-bds/bds-tools（需先 build）
 *
 * 注：仓库根 .gitignore 忽略名为 test 的路径，故用例放在包根而非 test/。
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(pkgRoot, "dist");

/** 与 recovery.js → dist/recovery.js 同构：根目录 shim 与 dist 模块同名 */
const MODULE_NAME = "_sfmc_is_main_fixture.js";
const distModule = path.join(distDir, MODULE_NAME);
const rootShim = path.join(pkgRoot, MODULE_NAME);
const alienEntry = path.join(pkgRoot, "_sfmc_alien_entry.js");

const moduleSrc = `
import { isMainModule } from "./is-main.js";
console.log(isMainModule(import.meta.url) ? "MAIN" : "NOT_MAIN");
`;

const shimSrc = `
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(__dirname, "dist", ${JSON.stringify(MODULE_NAME)})).href);
`;

const alienSrc = `
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(__dirname, "dist", ${JSON.stringify(MODULE_NAME)})).href);
`;

describe("isMainModule", () => {
  it("dist 直接作为 argv 入口时为 true", () => {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distModule, moduleSrc);
    const r = spawnSync(process.execPath, [distModule], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "MAIN");
  });

  it("同名根目录 shim 动态 import dist 时为 true（recovery.js 契约）", () => {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distModule, moduleSrc);
    fs.writeFileSync(rootShim, shimSrc);
    const r = spawnSync(process.execPath, [rootShim], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "MAIN");
  });

  it("被异名入口 import 时为 false（check-update 加载 bds-manager）", () => {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distModule, moduleSrc);
    fs.writeFileSync(alienEntry, alienSrc);
    const r = spawnSync(process.execPath, [alienEntry], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "NOT_MAIN");
  });

  after(() => {
    for (const p of [distModule, rootShim, alienEntry]) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  });
});
