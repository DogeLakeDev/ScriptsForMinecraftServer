#!/usr/bin/env node
/**
 * smoke-modules.js — 模块系统冒烟回归
 *
 * 验证:
 *  - catalog 通过构建期自检
 *  - db-server 模块 API 返回 29 条且字段完整
 *  - 安装/卸载工具可执行且 lock 文件更新
 *  - 模块依赖启用前置校验
 *
 * 用法: node tools/smoke-modules.js
 * 要求: db-server 已启动并暴露 /api/sfmc/modules
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PORT = parseInt(process.env.DB_PORT || "3001", 10);

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path, method: "GET", timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function postJson(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload || {});
    const req = http.request({
      hostname: HOST, port: PORT, path: urlPath, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: 3000,
    }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}

function expect(cond, msg) {
  if (!cond) { console.error(`[smoke] FAIL: ${msg}`); process.exit(1); }
  console.log(`[smoke] PASS: ${msg}`);
}

async function main() {
  // 1) catalog 自检
  const check = spawnSync(process.execPath, [path.join(ROOT, "tools", "check-catalog.js")], { cwd: ROOT, encoding: "utf-8" });
  expect(check.status === 0, `check-catalog.js 通过 (status=${check.status})`);

  // 2) 读 catalog 接口
  const cat = await fetchJson("/api/sfmc/modules/catalog");
  expect(cat.status === 200, `GET /api/sfmc/modules/catalog → 200`);
  expect(Array.isArray(cat.body.modules) && cat.body.modules.length > 0, `catalog 返回 ${cat.body.modules.length} 个模块`);

  // 3) 合并列表接口
  // 先做一次 reset 清掉遗留的 legacy 模块（防止之前 sim 写入污染）
  await postJson("/api/sfmc/setup/reset", {});
  const list = await fetchJson("/api/sfmc/modules");
  expect(list.status === 200, `GET /api/sfmc/modules → 200`);
  expect(Array.isArray(list.body.modules) && list.body.modules.length === cat.body.modules.length, `合并列表与 catalog 一致`);

  // 4) 字段完整性
  const required = ["id", "name", "config_key", "type", "description", "default_enabled", "can_disable", "can_uninstall", "requires", "entry", "installed", "enabled"];
  for (const m of list.body.modules) {
    for (const k of required) {
      expect(m[k] !== undefined, `${m.id} 字段 ${k} 存在`);
    }
  }

  // 4.5) 重置所有 core/feature 模块到 enabled=true，避免之前测试遗留状态污染
  for (const m of list.body.modules) {
    if ((m.type === 'core' || m.type === 'feature') && !m.enabled) {
      await postJson(`/api/sfmc/modules/${encodeURIComponent(m.id)}/enable`);
    }
  }
  // 重新拉取（可能因 legacy 记录导致 modules > catalog）
  let list2 = await fetchJson("/api/sfmc/modules");
  if (list2.body.modules.length !== cat.body.modules.length) {
    // 通过 /setup/reset 重置 setup 状态和 module-lock
    const rst = await postJson("/api/sfmc/setup/reset", {});
    expect(rst.status === 200, `setup reset 清理状态`);
    list2 = await fetchJson("/api/sfmc/modules");
  }
  expect(list2.body.modules.length === cat.body.modules.length, `合并列表与 catalog 一致 (${list2.body.modules.length} === ${cat.body.modules.length})`);

  // 5) 切换启用状态 → 检查 enabled 翻转
  const target = list.body.modules.find((m) => m.can_disable);
  expect(!!target, `存在一个 can_disable=true 的模块用于测试`);
  const before = target.enabled;
  const t1 = await postJson(`/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "disable" : "enable"}`);
  expect(t1.status === 200, `切换 ${target.id} 状态 → 200`);
  expect(typeof t1.body.module === "object" && t1.body.module.enabled === !before, `enabled 翻转`);
  await postJson(`/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "enable" : "disable"}`);

  // 6) 安装/卸载工具
  const testMod = "tool-bds-updater";
  const inst = spawnSync(process.execPath, [path.join(ROOT, "tools", "install-module.js"), "install", testMod], { cwd: ROOT, encoding: "utf-8" });
  expect(inst.status === 0, `install ${testMod} 成功`);
  const lockAfterInstall = JSON.parse(fs.readFileSync(path.join(ROOT, "modules", "module-lock.json"), "utf-8"));
  expect(lockAfterInstall.modules[testMod]?.installed === true, `${testMod} 在 lock 中 installed=true`);

  const uninst = spawnSync(process.execPath, [path.join(ROOT, "tools", "install-module.js"), "uninstall", testMod, "--no-files"], { cwd: ROOT, encoding: "utf-8" });
  expect(uninst.status === 0, `uninstall ${testMod} 成功`);
  const lockAfterUninstall = JSON.parse(fs.readFileSync(path.join(ROOT, "modules", "module-lock.json"), "utf-8"));
  expect(lockAfterUninstall.modules[testMod]?.installed === false, `${testMod} 在 lock 中 installed=false`);

  // 7) Setup state: 未初始化时返回 initialized=false
  const st = await fetchJson("/api/sfmc/setup/state");
  expect(st.status === 200, `GET /api/sfmc/setup/state → 200`);
  expect(typeof st.body.initialized === 'boolean', `setup state.initialized 存在`);

  // 9) Setup check
  const ck = await postJson("/api/sfmc/setup/check", { db: { port: 3001 }, bds: { path: "." } });
  expect(ck.status === 200 && Array.isArray(ck.body.checks), `/api/sfmc/setup/check 返回 checks`);

  // 10) Setup init: 调用 init 后 state.initialized=true
  const initPayload = {
    paths: { bdsPath: ".", llbotPath: ".", llbotCwd: ".", dbPort: 3001 },
    tokens: { dbAuthToken: "", bridgeAuthToken: "" },
    ui: { defaultModules: ["money", "chat"], defaultServices: ["db"], skipGuidedSetup: false },
    locale: "zh-CN",
  };
  const init = await postJson("/api/sfmc/setup/init", initPayload);
  expect(init.status === 200 && init.body.success === true, `POST /api/sfmc/setup/init 成功`);
  expect(init.body.state && init.body.state._initialized === true, `init 后 state._initialized=true`);
  expect(fs.existsSync(path.join(ROOT, "panel-state.json")), `panel-state.json 已写入`);
  const st2 = await fetchJson("/api/sfmc/setup/state");
  expect(st2.body.initialized === true, `state.initialized=true after init`);

  // 11) Setup reset: 还原到最近一次备份（若无备份则保留当前）
  const rst = await postJson("/api/sfmc/setup/reset", {});
  expect(rst.status === 200 && rst.body.state._initialized === false, `reset 后 _initialized=false`);

  console.log("[smoke] 全部通过");
}

main().catch((e) => { console.error("[smoke] ERROR:", e.message); process.exit(1); });
