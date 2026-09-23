/** 编号菜单按后端、群和用户隔离；错误输入不消费菜单。 */
export type PendingChoice = { choices: Map<number, string>; expiresAt: number };
export type ChoiceResult = { kind: "chosen"; command: string } | { kind: "missing" | "expired" | "invalid" };
export class PendingChoiceStore {
  private readonly map = new Map<string, PendingChoice>();
  constructor(private readonly ttlMs = 60_000) {}
  private key(backend: string, groupId: string, userId: string): string {
    return JSON.stringify([backend, groupId, userId]);
  }
  set(backend: string, groupId: string, userId: string, choices: Map<number, string>): void {
    for (const [key, entry] of this.map) {
      if (entry.expiresAt + this.ttlMs < Date.now()) this.map.delete(key);
    }
    this.map.set(this.key(backend, groupId, userId), { choices, expiresAt: Date.now() + this.ttlMs });
  }
  choose(backend: string, groupId: string, userId: string, n: number): ChoiceResult {
    const key = this.key(backend, groupId, userId);
    const entry = this.map.get(key);
    if (!entry) return { kind: "missing" };
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return { kind: "expired" };
    }
    const command = entry.choices.get(n);
    if (!command) return { kind: "invalid" };
    this.map.delete(key);
    return { kind: "chosen", command };
  }
  take(backend: string, groupId: string, userId: string, n: number): string | null {
    const result = this.choose(backend, groupId, userId, n);
    return result.kind === "chosen" ? result.command : null;
  }
  clear(backend: string, groupId: string, userId: string): void {
    this.map.delete(this.key(backend, groupId, userId));
  }
}
