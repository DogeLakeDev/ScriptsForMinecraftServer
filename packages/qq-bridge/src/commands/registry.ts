/**
 * commands/registry.ts — 指令注册与查找
 */

import type { RegisteredCommand } from "./types.js";

/** 去掉前导 /、空白，统一小写 */
export function normalizeTrigger(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^[/／]+/, "")
    .toLowerCase();
}

export class CommandRegistry {
  private readonly byAlias = new Map<string, RegisteredCommand>();
  private readonly list: RegisteredCommand[] = [];

  register(cmd: RegisteredCommand): void {
    this.list.push(cmd);
    const names = new Set([cmd.name, ...cmd.aliases].map((a) => normalizeTrigger(a)));
    for (const alias of names) {
      if (!alias) continue;
      this.byAlias.set(alias, cmd);
    }
  }

  resolve(raw: string): RegisteredCommand | null {
    const key = normalizeTrigger(raw);
    if (!key) return null;
    const exact = this.byAlias.get(key);
    if (exact) return exact;
    // 带参数：取首词匹配（如「申请入服 Steve」→ join）
    const first = key.split(/\s+/)[0] ?? "";
    if (!first || first === key) return null;
    return this.byAlias.get(first) ?? null;
  }

  all(): readonly RegisteredCommand[] {
    return this.list;
  }

  /** 主菜单 / 官方快捷菜单：排除管理子菜单项 */
  userMenu(): RegisteredCommand[] {
    return this.list.filter((c) => !c.adminMenu);
  }

  /** 管理子菜单 */
  adminMenu(): RegisteredCommand[] {
    return this.list.filter((c) => !!c.adminMenu);
  }
}
