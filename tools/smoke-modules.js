#!/usr/bin/env node
/**
 * smoke-modules.js — 模块系统冒烟回归
 *
 * 验证:
 *  - catalog 通过构建期自检
 *  - db-server 模块 API 与 catalog 对齐（允许空：平台壳未安装业务包）
 *  - 若有 can_disable 模块，验证启停翻转
 *
 * 用法: node tools/smoke-modules.js
 * 要求: db-server 已启动并暴露 /api/sfmc/modules
 */
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PORT = parseInt(process.env.DB_PORT || "3001", 10);

function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path: urlPath, method: "GET", timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
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
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: urlPath,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 3000,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(d) });
          } catch {
            resolve({ status: res.statusCode, body: d });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}

function expect(cond, msg) {
  if (!cond) {
    console.error(`[smoke] FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`[smoke] PASS: ${msg}`);
}

async function main() {
  // 1) catalog 自检
  const check = spawnSync(process.execPath, [path.join(ROOT, "tools", "check-catalog.js")], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  expect(check.status === 0, `check-catalog.js 通过 (status=${check.status})`);

  // 2) 读取 catalog 接口（空 catalog = 平台壳未安装业务包，合法）
  const cat = await fetchJson("/api/sfmc/modules/catalog");
  expect(cat.status === 200, `GET /api/sfmc/modules/catalog → 200`);
  expect(Array.isArray(cat.body.modules), `catalog.modules 为数组 (len=${cat.body.modules.length})`);

  // 3) 合并列表接口
  const list = await fetchJson("/api/sfmc/modules");
  expect(list.status === 200, `GET /api/sfmc/modules → 200`);
  expect(
    Array.isArray(list.body.modules) && list.body.modules.length === cat.body.modules.length,
    `合并列表与 catalog 一致`
  );

  if (list.body.modules.length === 0) {
    console.log("[smoke] catalog 为空 — 跳过启停翻转（请先 fetch-module + rebuild-catalog）");
    console.log("[smoke] 全部通过");
    return;
  }

  // 4) 字段完整性
  const required = [
    "id",
    "name",
    "config_key",
    "type",
    "description",
    "default_enabled",
    "can_disable",
    "requires",
    "entry",
    "enabled",
  ];
  for (const m of list.body.modules) {
    for (const k of required) {
      expect(m[k] !== undefined, `${m.id} 字段 ${k} 存在`);
    }
  }

  // 4.5) 重置所有 core/feature 模块到 enabled=true，避免之前测试遗留状态污染
  for (const m of list.body.modules) {
    if ((m.type === "core" || m.type === "feature") && !m.enabled) {
      await postJson(`/api/sfmc/modules/${encodeURIComponent(m.id)}/enable`);
    }
  }
  const list2 = await fetchJson("/api/sfmc/modules");
  expect(
    list2.body.modules.length === cat.body.modules.length,
    `合并列表与 catalog 一致 (${list2.body.modules.length} === ${cat.body.modules.length})`
  );

  // 5) 切换启用状态 → 检查 enabled 翻转
  const target = list.body.modules.find((m) => m.can_disable);
  expect(!!target, `存在一个 can_disable=true 的模块用于测试`);
  const before = target.enabled;
  const t1 = await postJson(`/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "disable" : "enable"}`);
  expect(t1.status === 200, `切换 ${target.id} 状态 → 200`);
  expect(typeof t1.body.module === "object" && t1.body.module.enabled === !before, `enabled 翻转`);
  await postJson(`/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "enable" : "disable"}`);

  console.log("[smoke] 全部通过");
}

main().catch((e) => {
  console.error("[smoke] ERROR:", e.message);
  process.exit(1);
});
