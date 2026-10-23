/**
 * module-dependencies.ts — 安装前的模块依赖判断
 *
 * 使用场景：桌面端在安装按钮和详情里说明缺什么；守护进程在 modules.install 真正下载前再判一次。
 * 索引的 requires 是依赖名单。依赖必须已经安装并且启用，因为行为包只收录启用的模块。
 * requires 不是字符串数组时视为没有声明，不允许安装。
 */
import type { ModuleRow } from "./methods.js";

/** 一条依赖相对本机模块的状态。ready 表示已安装且启用。 */
export interface ModuleDependencyItem {
  id: string;
  status: "ready" | "disabled" | "missing";
}

/** 一次依赖检查的结果。declared 为 false 时不应开始安装。 */
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
 * 使用场景：安装页详情，以及守护进程拒绝不满足依赖的安装。
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
 * 使用场景：守护进程拒绝 modules.install，以及预览桥在下载前拒绝同一条规则。通过时返回 null。
 */
export function moduleRequireBlockMessage(id: string, check: ModuleDependencyCheck): string | null {
  if (check.declared && check.ok) return null;
  if (!check.declared) return `索引没有给出「${id}」的依赖声明，已取消安装。请刷新模块索引后再试。`;
  const missing = check.items.filter((item) => item.status === "missing").map((item) => item.id);
  const disabled = check.items.filter((item) => item.status === "disabled").map((item) => item.id);
  const parts: string[] = [];
  if (missing.length) parts.push(`尚未安装：${missing.join("、")}`);
  if (disabled.length) parts.push(`已安装但未启用：${disabled.join("、")}`);
  return `「${id}」的依赖未满足，已取消安装。${parts.join("。")}。请先安装并启用缺少的模块，或到已安装列表里启用停用的模块。`;
}
