import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const locks = new AsyncLocalStorage<{ root: string; nonce: string }>();
export function maintenanceToken(root: string): string | undefined {
  const scope = locks.getStore();
  return scope?.root === path.resolve(root) ? scope.nonce : undefined;
}

/** 跨 CLI、守护进程和独立维护进程共享的实例锁；释放前校验所有权。 */
export async function withMaintenanceLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  if (maintenanceToken(root)) return action();
  const file = path.join(root, ".sfmc", "maintenance.lock");
  await fs.mkdir(path.dirname(file), { recursive: true });
  const nonce = randomUUID();
  let handle;
  try { handle = await fs.open(file, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const owner = await fs.readFile(file, "utf8").then(text => JSON.parse(text) as { pid: number }).catch(() => null);
    if (!owner || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw Object.assign(new Error("维护锁正在创建或已损坏；请稍后重试并核对任务状态"), { code: "locked" });
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (probe) { alive = (probe as NodeJS.ErrnoException).code !== "ESRCH"; }
    if (alive) throw Object.assign(new Error("另一个管理操作正在执行"), { code: "locked" });
    throw Object.assign(new Error("前一次维护异常退出；请核对任务与备份后人工解除维护锁"), { code: "locked" });
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, nonce, createdAt: new Date().toISOString() }));
    await handle.close();
    return await locks.run({ root: path.resolve(root), nonce }, action);
  } finally {
    await handle.close().catch(() => {});
    const owner = await fs.readFile(file, "utf8").then(text => JSON.parse(text) as { nonce: string }).catch(() => null);
    if (owner?.nonce === nonce) await fs.unlink(file);
  }
}
