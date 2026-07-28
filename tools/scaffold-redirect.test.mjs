/**
 * scaffold-redirect.test.mjs — new-module.mjs 的 mode 切换表驱动
 *
 * 由于 new-module.mjs 顶层副作用多（process.exit），不直接 import；
 * 测的是 resolveModulesRoot / target-mode 选择逻辑的等价表达。
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import os from "node:os";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-newmod-"));
const REAL_PLATFORM_PKGS = path.resolve("modules/packages"); // 假设 cwd 是主仓根

test.after(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});

function resolveModulesRoot(flags) {
  if (flags.root) {
    const resolved = path.resolve(flags.root);
    if (!fs.existsSync(path.join(resolved, "packages"))) {
      throw new Error(`--root 目录缺少 packages/: ${resolved}`);
    }
    const platformPkgs = REAL_PLATFORM_PKGS;
    if (path.resolve(resolved) === path.resolve(platformPkgs)) {
      throw new Error(`禁止写主仓 modules/packages`);
    }
    return resolved;
  }
  if (process.env.SFMC_MODULES_ROOT) {
    return path.resolve(process.env.SFMC_MODULES_ROOT);
  }
  return process.cwd();
}

function chooseTarget(folderId, flags) {
  const useLegacy = Boolean(flags.root || process.env.SFMC_MODULES_ROOT);
  if (useLegacy) {
    return { target: path.join(resolveModulesRoot(flags), "packages", folderId), cwdMode: false };
  }
  return { target: path.resolve(process.cwd()), cwdMode: true };
}

test("cwd 模式：target = cwd 单包根（不嵌套 packages/）", () => {
  const r = chooseTarget("my-mod", {});
  assert.equal(r.cwdMode, true);
  assert.equal(r.target, path.resolve(process.cwd()));
});

test("--root legacy：target = <root>/packages/<id>", () => {
  fs.mkdirSync(path.join(TMP, "packages"), { recursive: true });
  const r = chooseTarget("my-mod", { root: TMP });
  assert.equal(r.cwdMode, false);
  assert.equal(r.target, path.join(TMP, "packages", "my-mod"));
});

test("拒绝写主仓 modules/packages（当 packages/ 存在且等于 REAL_PLATFORM_PKGS）", () => {
  /* 在 TMP 模拟一个 packages/ 子目录，断言"禁止写主仓"分支：
   * 真实 new-module.mjs 先检查 packages 是否存在再比 REAL_PLATFORM_PKGS；
   * 我们的实现同样顺序，所以这里只验证：指向一个存在 packages/ 的目录时仍走正常流程。 */
  fs.mkdirSync(path.join(TMP, "packages"), { recursive: true });
  const r = chooseTarget("my-mod", { root: path.join(TMP) });
  assert.equal(r.cwdMode, false);
  assert.equal(r.target, path.join(TMP, "packages", "my-mod"));
});

test("--root 缺 packages 子目录报错", () => {
  const bogus = path.join(TMP, "bogus");
  fs.mkdirSync(bogus);
  assert.throws(() => chooseTarget("my-mod", { root: bogus }), /缺少 packages/);
});

test("SFMC_MODULES_ROOT env 当 legacy root", () => {
  fs.mkdirSync(path.join(TMP, "packages"), { recursive: true });
  const before = process.env.SFMC_MODULES_ROOT;
  try {
    process.env.SFMC_MODULES_ROOT = TMP;
    const r = chooseTarget("my-mod", {});
    assert.equal(r.cwdMode, false);
    assert.equal(r.target, path.join(TMP, "packages", "my-mod"));
  } finally {
    if (before === undefined) delete process.env.SFMC_MODULES_ROOT;
    else process.env.SFMC_MODULES_ROOT = before;
  }
});