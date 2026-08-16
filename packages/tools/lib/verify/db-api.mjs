// @ts-check
/**
 * db-server 平台 REST 断言（空 catalog 为主仓默认路径；有模块时含 enable/disable）
 */
import { requestJson } from "../http.mjs";

const MODULE_FIELDS = [
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

/**
 * @param {number} port
 * @returns {Promise<{ moduleCount: number }>}
 */
export async function assertPlatformDbApi(port) {
  const health = await requestJson({ port, method: "GET", path: "/api/health" });
  if (health.status !== 200) throw new Error(`health ${health.status}`);

  const mods = await requestJson({ port, method: "GET", path: "/api/sfmc/modules" });
  if (mods.status !== 200 || !Array.isArray(mods.body.modules)) {
    throw new Error(`modules 接口异常 ${mods.status}`);
  }

  const all = await requestJson({ port, method: "GET", path: "/api/sfmc/configs/all" });
  if (all.status !== 200 || !Array.isArray(all.body.modules)) {
    throw new Error(`configs/all.modules 异常 ${all.status}`);
  }
  if (!all.body.module_tokens || typeof all.body.module_tokens !== "object") {
    throw new Error("configs/all 缺少 module_tokens");
  }
  if (Array.isArray(all.body.banned_items)) {
    const bad = all.body.banned_items.find((/** @type {unknown} */ x) => typeof x !== "string");
    if (bad !== undefined) {
      throw new Error(`configs/all.banned_items 须为 string[]，收到 ${typeof bad}`);
    }
  }

  return { moduleCount: mods.body.modules.length };
}

/**
 * @param {number} port
 * @returns {Promise<{ moduleCount: number; toggled: boolean }>}
 */
export async function assertModuleRestApi(port) {
  const cat = await requestJson({ port, method: "GET", path: "/api/sfmc/modules/catalog" });
  if (cat.status !== 200) throw new Error(`GET /api/sfmc/modules/catalog → ${cat.status}`);
  if (!Array.isArray(cat.body.modules)) throw new Error("catalog.modules 不是数组");

  const list = await requestJson({ port, method: "GET", path: "/api/sfmc/modules" });
  if (list.status !== 200) throw new Error(`GET /api/sfmc/modules → ${list.status}`);
  if (!Array.isArray(list.body.modules)) throw new Error("modules 不是数组");
  if (list.body.modules.length !== cat.body.modules.length) {
    throw new Error(
      `合并列表与 catalog 不一致 (${list.body.modules.length} vs ${cat.body.modules.length})`
    );
  }

  const moduleCount = list.body.modules.length;
  if (moduleCount === 0) {
    return { moduleCount: 0, toggled: false };
  }

  for (const m of list.body.modules) {
    for (const k of MODULE_FIELDS) {
      if (m[k] === undefined) throw new Error(`${m.id} 缺少字段 ${k}`);
    }
  }

  const target = list.body.modules.find((/** @type {{ can_disable: boolean }} */ m) => m.can_disable);
  if (!target) {
    return { moduleCount, toggled: false };
  }

  const before = target.enabled;
  const t1 = await requestJson({
    port,
    method: "POST",
    path: `/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "disable" : "enable"}`,
    body: {},
  });
  if (t1.status !== 200) throw new Error(`切换 ${target.id} → ${t1.status}`);
  if (typeof t1.body.module !== "object" || t1.body.module.enabled === before) {
    throw new Error(`${target.id} enabled 未翻转`);
  }
  await requestJson({
    port,
    method: "POST",
    path: `/api/sfmc/modules/${encodeURIComponent(target.id)}/${before ? "enable" : "disable"}`,
    body: {},
  });

  return { moduleCount, toggled: true };
}
