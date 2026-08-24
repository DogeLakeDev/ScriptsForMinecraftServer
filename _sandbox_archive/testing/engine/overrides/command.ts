/**
 * 薄 L2：runCommand 记录命令串并返回 successCount。
 * 可选副作用：gamemode；give/clear → 物品栏；ability → 能力状态袋（area/fly）。
 * 解析不了的保持记录-only，不抛错。
 */

import { ItemStack, type FakeContainer } from "./inventory.js";

export type FakeCommandResult = {
  readonly successCount: number;
};

export function createCommandResult(successCount = 1): FakeCommandResult {
  return { successCount };
}

/** 归一化 GameMode 字面量；无法识别则返回 undefined。 */
export function normalizeGameMode(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  const aliases: Record<string, string> = {
    survival: "Survival",
    s: "Survival",
    "0": "Survival",
    creative: "Creative",
    c: "Creative",
    "1": "Creative",
    adventure: "Adventure",
    a: "Adventure",
    "2": "Adventure",
    spectator: "Spectator",
    sp: "Spectator",
    "3": "Spectator",
  };
  if (aliases[lower]) return aliases[lower];
  // 已是 pin 枚举字面量
  if (s === "Survival" || s === "Creative" || s === "Adventure" || s === "Spectator") return s;
  return undefined;
}

/** 解析命令参数：支持 "quoted name" / 'quoted' / 裸 token。 */
function nextToken(rest: string): { token: string; rest: string } | undefined {
  const s = rest.trimStart();
  if (!s) return undefined;
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0];
    const end = s.indexOf(q, 1);
    if (end < 0) return undefined;
    return { token: s.slice(1, end), rest: s.slice(end + 1) };
  }
  const m = /^(\S+)(.*)$/.exec(s);
  if (!m) return undefined;
  return { token: m[1]!, rest: m[2] ?? "" };
}

function normalizeItemTypeId(id: string): string {
  const s = String(id ?? "").trim();
  if (!s) return "";
  return s.includes(":") ? s : `minecraft:${s}`;
}

/** 目标是否指向本实体（@s/@p/@a 或名字匹配）。 */
export function isSelfCommandTarget(target: string, selfName?: string): boolean {
  const t = String(target ?? "").trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower === "@s" || lower === "@p" || lower === "@a" || lower === "@e") return true;
  if (selfName != null && t === selfName) return true;
  return false;
}

export type ParsedGiveClear =
  | { kind: "give"; itemId: string; amount: number; data: number }
  | { kind: "clear"; itemId: string; data: number; maxCount: number };

/**
 * 解析 `give <target> <item> [amount] [data]` / `clear <target> <item> [data] [maxCount]`。
 * 不匹配则返回 undefined（调用方仍只记录）。
 */
export function parseGiveOrClear(cmd: string): ParsedGiveClear | undefined {
  const give = /^give\s+/i.exec(cmd);
  if (give) {
    let rest = cmd.slice(give[0].length);
    const targetTok = nextToken(rest);
    if (!targetTok) return undefined;
    rest = targetTok.rest;
    const itemTok = nextToken(rest);
    if (!itemTok) return undefined;
    rest = itemTok.rest;
    const amountTok = nextToken(rest);
    const amount = amountTok ? Number(amountTok.token) : 1;
    rest = amountTok?.rest ?? rest;
    const dataTok = nextToken(rest);
    const data = dataTok ? Number(dataTok.token) : 0;
    const itemId = normalizeItemTypeId(itemTok.token);
    if (!itemId) return undefined;
    const n = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
    return {
      kind: "give",
      itemId,
      amount: Math.min(n, 255),
      data: Number.isFinite(data) ? Math.floor(data) : 0,
    };
  }

  const clear = /^clear\s+/i.exec(cmd);
  if (clear) {
    let rest = cmd.slice(clear[0].length);
    const targetTok = nextToken(rest);
    if (!targetTok) return undefined;
    rest = targetTok.rest;
    const itemTok = nextToken(rest);
    if (!itemTok) return undefined;
    rest = itemTok.rest;
    // clear：data 在前，maxCount 在后（与 give 的 amount/data 顺序不同）
    const dataTok = nextToken(rest);
    const data = dataTok ? Number(dataTok.token) : -1;
    rest = dataTok?.rest ?? rest;
    const countTok = nextToken(rest);
    const maxCount = countTok ? Number(countTok.token) : -1;
    const itemId = normalizeItemTypeId(itemTok.token);
    if (!itemId) return undefined;
    return {
      kind: "clear",
      itemId,
      data: Number.isFinite(data) ? Math.floor(data) : -1,
      maxCount: Number.isFinite(maxCount) ? Math.floor(maxCount) : -1,
    };
  }

  return undefined;
}

/** 从容器移除最多 maxCount 个同 typeId 物品（data 忽略）；maxCount<0 表示清光。 */
export function clearItemsFromContainer(
  container: FakeContainer,
  itemId: string,
  maxCount: number
): number {
  const want = normalizeItemTypeId(itemId);
  let left = maxCount < 0 ? Number.POSITIVE_INFINITY : Math.max(0, maxCount);
  let removed = 0;
  for (let i = 0; i < container.size && left > 0; i++) {
    const stack = container.getItem(i);
    if (!stack || stack.typeId !== want) continue;
    if (stack.amount <= left) {
      removed += stack.amount;
      left -= stack.amount;
      container.setItem(i, undefined);
    } else {
      removed += left;
      const next = stack.clone();
      next.amount -= left;
      container.setItem(i, next);
      left = 0;
    }
  }
  return removed;
}

export type ParsedAbility = {
  target: string;
  ability: string;
  value: boolean;
};

/**
 * 解析 `ability <target> <ability> <true|false|1|0>`（area/fly 主路径）。
 * 不匹配则返回 undefined。
 */
export function parseAbility(cmd: string): ParsedAbility | undefined {
  const m = /^ability\s+/i.exec(cmd);
  if (!m) return undefined;
  let rest = cmd.slice(m[0].length);
  const targetTok = nextToken(rest);
  if (!targetTok) return undefined;
  rest = targetTok.rest;
  const abilityTok = nextToken(rest);
  if (!abilityTok) return undefined;
  rest = abilityTok.rest;
  const valueTok = nextToken(rest);
  if (!valueTok) return undefined;
  const raw = valueTok.token.trim().toLowerCase();
  let value: boolean | undefined;
  if (raw === "true" || raw === "1") value = true;
  else if (raw === "false" || raw === "0") value = false;
  if (value === undefined) return undefined;
  const ability = abilityTok.token.trim().toLowerCase();
  if (!ability) return undefined;
  return { target: targetTok.token, ability, value };
}

export type ThinCommandOpts = {
  onGamemode?: (mode: string) => void;
  /** 玩家名：用于判断 give/clear/ability 目标是否为本实体 */
  selfName?: string;
  /** 本实体物品栏；缺省则 give/clear 只记录 */
  inventory?: FakeContainer;
  /** ability 副作用（area/fly：mayfly 等） */
  onAbility?: (ability: string, value: boolean) => void;
  /** 从命令串提取目标 token，供 isSelfCommandTarget */
  resolveTarget?: (cmd: string) => string | undefined;
};

function extractTarget(cmd: string): string | undefined {
  const m = /^(?:give|clear|ability)\s+/i.exec(cmd);
  if (!m) return undefined;
  const tok = nextToken(cmd.slice(m[0].length));
  return tok?.token;
}

/**
 * 记录命令；可选 gamemode / give / clear / ability 副作用。
 */
export function runThinCommand(
  commandLog: string[],
  commandString: string,
  opts?: ThinCommandOpts
): FakeCommandResult {
  const cmd = String(commandString ?? "")
    .replace(/^\//, "")
    .trim();
  commandLog.push(cmd);

  const gm = /^gamemode\s+(\S+)/i.exec(cmd);
  if (gm && opts?.onGamemode) {
    const mode = normalizeGameMode(gm[1]);
    if (mode) opts.onGamemode(mode);
  }

  if (opts?.onAbility) {
    const ability = parseAbility(cmd);
    if (ability && isSelfCommandTarget(ability.target, opts.selfName)) {
      opts.onAbility(ability.ability, ability.value);
    }
  }

  const inv = opts?.inventory;
  if (inv) {
    const parsed = parseGiveOrClear(cmd);
    if (parsed) {
      const target = (opts.resolveTarget ?? extractTarget)(cmd);
      if (target && isSelfCommandTarget(target, opts.selfName)) {
        if (parsed.kind === "give") {
          try {
            inv.addItem(new ItemStack(parsed.itemId, parsed.amount));
          } catch {
            /* 非法物品 id 等：仍已记录，不炸模块路径 */
          }
        } else {
          clearItemsFromContainer(inv, parsed.itemId, parsed.maxCount);
        }
      }
    }
  }

  return createCommandResult(1);
}
