/**
 * commands/pending.ts — llbot 编号菜单短期会话
 */

const DEFAULT_TTL_MS = 60_000;

export type PendingChoice = {
  /** 编号 → 规范化命令（如 `/ping`） */
  choices: Map<number, string>;
  expiresAt: number;
};

export class PendingChoiceStore {
  private readonly map = new Map<string, PendingChoice>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(backend: string, groupId: string, userId: string): string {
    return `${backend}:${groupId}:${userId}`;
  }

  set(backend: string, groupId: string, userId: string, choices: Map<number, string>): void {
    this.map.set(this.key(backend, groupId, userId), {
      choices,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** 取编号对应命令；命中或过期都会清掉该会话 */
  take(backend: string, groupId: string, userId: string, n: number): string | null {
    const k = this.key(backend, groupId, userId);
    const entry = this.map.get(k);
    if (!entry) return null;
    this.map.delete(k);
    if (Date.now() > entry.expiresAt) return null;
    return entry.choices.get(n) ?? null;
  }

  clear(backend: string, groupId: string, userId: string): void {
    this.map.delete(this.key(backend, groupId, userId));
  }
}
