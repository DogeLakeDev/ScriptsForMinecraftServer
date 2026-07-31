/**
 * 薄 L2：runCommand 只记录命令串并返回 successCount；可选解析 gamemode。
 * 不模拟 give/clear/ability 等世界副作用（避免假绿）。
 */

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

/**
 * 记录命令；若匹配 `gamemode <mode>` 则回调（供 Player 同步 getGameMode）。
 */
export function runThinCommand(
  commandLog: string[],
  commandString: string,
  opts?: { onGamemode?: (mode: string) => void }
): FakeCommandResult {
  const cmd = String(commandString ?? "")
    .replace(/^\//, "")
    .trim();
  commandLog.push(cmd);
  const m = /^gamemode\s+(\S+)/i.exec(cmd);
  if (m && opts?.onGamemode) {
    const mode = normalizeGameMode(m[1]);
    if (mode) opts.onGamemode(mode);
  }
  return createCommandResult(1);
}
