/**
 * module-dependencies.ts — 安装页上的模块依赖判断
 *
 * 使用场景：可安装模块的卡片和详情。索引给出 requires 数组时，依赖必须已安装并启用。
 * 字段缺失表示当前平台还没带上依赖名单（已发布的 0.2.20 就是这样），调用方应继续原来的安装。
 */
import type { ModuleRow } from "@sfmc-bds/management";

/** 一条依赖相对本机模块的状态。ready 表示已安装且启用。 */
export interface ModuleDependencyItem {
  id: string;
  status: "ready" | "disabled" | "missing";
}

/** 一次依赖检查的结果。declared 为 false 时表示名单缺失或格式不对。 */
export interface ModuleDependencyCheck {
  declared: boolean;
  ok: boolean;
  items: ModuleDependencyItem[];
}

/** 已安装模块里用来对上 requires 的字段。 */
export type InstalledModuleRef = Pick<ModuleRow, "id" | "folder" | "enabled">;

/**
 * 把目录名和逻辑 id 收成同一个比较键。
 * 使用场景：requires 写 land，本机目录可能是 sfmc-module-land。
 */
export function moduleIdentity(id: string): string {
  return id.trim().replace(/^(?:sfmc-module-|feature-|core-)/, "");
}

/**
 * 判断这份 requires 是否允许安装。
 * 使用场景：安装页在索引已经给出依赖数组时核对；守护进程侧的同一规则尚未随 0.2.20 发布。
 */
export function assessModuleRequires(requires: unknown, installed: InstalledModuleRef[]): ModuleDependencyCheck {
  if (!Array.isArray(requires) || requires.some((item) => typeof item !== "string" || !item.trim())) {
    return { declared: false, ok: false, items: [] };
  }
  const items = requires.map((item: string) => {
    const id = item.trim();
    const key = moduleIdentity(id);
    const matches = installed.filter((row) => moduleIdentity(row.id) === key || moduleIdentity(row.folder) === key);
    const status: ModuleDependencyItem["status"] = matches.some((row) => row.enabled)
      ? "ready"
      : matches.length
        ? "disabled"
        : "missing";
    return { id, status };
  });
  return { declared: true, ok: items.every((item) => item.status === "ready"), items };
}

/**
 * 把未通过的依赖检查写成给用户看的说明。
 * 使用场景：预览桥在索引已经给出 requires 时拒绝安装。名单缺失时返回 null，沿用原来的安装。
 */
export function moduleRequireBlockMessage(id: string, requires: unknown, installed: InstalledModuleRef[]): string | null {
  if (!Array.isArray(requires)) return null;
  const check = assessModuleRequires(requires, installed);
  if (check.ok) return null;
  if (!check.declared) return `索引里的「${id}」依赖名单格式不对，已取消安装。`;
  const missing = check.items.filter((item) => item.status === "missing").map((item) => item.id);
  const disabled = check.items.filter((item) => item.status === "disabled").map((item) => item.id);
  const parts: string[] = [];
  if (missing.length) parts.push(`尚未安装：${missing.join("、")}`);
  if (disabled.length) parts.push(`已安装但未启用：${disabled.join("、")}`);
  return `「${id}」的依赖未满足，已取消安装。${parts.join("。")}。请先安装并启用缺少的模块，或到已安装列表里启用停用的模块。`;
}
