#!/usr/bin/env node
/**
 * tools/smoke-modules.mjs — 模块 API 冒烟(需已启动的 db-server)
 *
 * - 空 catalog:只验证平台 modules API 返回空数组即可通过
 * - 有模块:校验字段 + can_disable 启停翻转
 *
 * 用法: node tools/smoke-modules.mjs
 * 环境: DB_PORT(默认 3001)
 */
import path from "node:path";
import process from "node:process";
import { ROOT } from "./lib/paths.mjs";
import { requestJson } from "./lib/http.mjs";
import { runSync } from "./lib/proc.mjs";

const PORT = parseInt(process.env.DB_PORT || "3001", 10);

function expect(cond, msg) {
  if (!cond) {
    console.error(`[smoke] FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`[smoke] PASS: ${msg}`);
}

async function main() {
  const check = runSync(process.execPath, [path.join(ROOT, "tools", "check-modules.mjs")], {
    cwd: ROOT,
  });
  expect(check.status === 0, `check-modules 通过 (status=${check.status})`);

  const cat = await requestJson({ port: PORT, method: "GET", path: "/api/sfmc/modules/catalog" });
  expect(cat.status === 200, `GET /api/sfmc/modules/catalog → 200`);
  expect(Array.isArray(cat.body.modules), `catalog.modules 是数组`);

  const list = await requestJson({ port: PORT, method: "GET", path: "/api/sfmc/modules" });
  expect(list.status === 200, `GET /api/sfmc/modules → 200`);
  expect(
    Array.isArray(list.body.modules) && list.body.modules.length === cat.body.modules.length,
    `合并列表与 catalog 一致 (n=${list.body.modules.length})`
  );

  if (list.body.modules.length === 0) {
    console.log("[smoke] catalog 为空 — 平台 API 通过(无业务模块可翻转)");
    console.log("[smoke] 全部通过");
    return;
  }

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

  const target = list.body.modules.find((m) => m.can_disable);
  if (!target) {
    console.log("[smoke] 无 can_disable 模块 — 跳过启停翻转");
    console.log("[smoke] 全部通过");
    return;
  }

  const before = target.enabled;
  const t1 = await requestJson({
    port: PORT,
    method: "POST",
    path: `/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "disable" : "enable"}`,
    body: {},
  });
  expect(t1.status === 200, `切换 ${target.id} 状态 → 200`);
  expect(
    typeof t1.body.module === "object" && t1.body.module.enabled === !before,
    `enabled 翻转`
  );
  await requestJson({
    port: PORT,
    method: "POST",
    path: `/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "enable" : "disable"}`,
    body: {},
  });

  console.log("[smoke] 全部通过");
}

main().catch((e) => {
  console.error("[smoke] ERROR:", e.message);
  process.exit(1);
});
