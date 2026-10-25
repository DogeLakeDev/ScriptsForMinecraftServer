/**
 * config-keys.ts — 配置键的分组与展示名
 *
 * 使用场景：配置列表页分组展示、编辑页标题。规则与桌面端 ConfigPage.tsx 的 CORE_NAMES / describeKey 相同；
 * 那份定义在引用 Monaco 的 React 页面文件中，无法打包复用，这里保留一份（修改时需两边同步）。
 */

/** 核心配置文件的友好名称 */
const CORE_NAMES: Record<string, string> = {
  "runtime.json": "运行时",
  "db_config.json": "数据服务",
  "qq_config.json": "QQ 互通",
  "bds_updater.json": "BDS 更新",
  "permissions.json": "权限",
  "log-filter.json": "日志过滤",
  "module-update.json": "模块更新",
  "pack-update.json": "世界包更新",
  "server.properties": "BDS配置",
};

/** 配置键的展示信息；names 为模块逻辑 id → 展示名 */
export function describeKey(key: string, names?: Map<string, string>): { group: string; title: string; file: string; icon: string } {
  const parts = key.split("/");
  const file = parts[parts.length - 1] ?? key;
  if (parts[0] === "core") return { group: "核心配置", title: CORE_NAMES[file] ?? file, file, icon: "settings" };
  if (parts[0] === "bds") return { group: "BDS", title: CORE_NAMES[file] ?? file, file, icon: "cube" };
  if (parts[0] === "module") {
    const id = parts[1] ?? "";
    const label = names?.get(id);
    return { group: label && label !== id ? label : `模块 ${id}`, title: file, file: parts.slice(1).join("/"), icon: "modules" };
  }
  return { group: "其他", title: file, file: key, icon: "file-code" };
}
