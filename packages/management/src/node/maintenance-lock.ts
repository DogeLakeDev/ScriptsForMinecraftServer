import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const locks = new AsyncLocalStorage<{ root: string; nonce: string }>();
export function maintenanceToken(root: string): string | undefined {
  const scope = locks.getStore();
  return scope?.root === path.resolve(root) ? scope.nonce : undefined;
}

/**
 * 维护锁记录的 pid 是否仍在运行。
 * 使用场景：判断锁是另一次维护还持有，还是进程已被系统杀掉后留下的过期锁。
 * 只有 ESRCH 视为已退出；EPERM 等错误仍当作存活，避免误清别人的锁。
 */
export function lockOwnerAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (probe) { return (probe as NodeJS.ErrnoException).code !== "ESRCH"; }
}

/**
 * 是否存在仍被活进程持有的维护锁。
 * 使用场景：守护进程决定能不能拉起，以及 --autostart 能不能开机拉服务。
 * 持有者已退出时返回 false，调用方可以启动；文件损坏或正在创建时返回 true，避免抢半截锁。
 */
export function isMaintenanceLocked(root: string): boolean {
  const file = path.join(root, ".sfmc", "maintenance.lock");
  let text: string;
  try { text = fsSync.readFileSync(file, "utf8"); }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ENOENT"; }
  let owner: { pid?: number } | null = null;
  try { owner = JSON.parse(text) as { pid?: number }; }
  catch { return true; }
  const pid = owner?.pid;
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) return true;
  return lockOwnerAlive(pid);
}

/** 跨 CLI、守护进程和独立维护进程共享的实例锁；释放前校验所有权。 */
export async function withMaintenanceLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  if (maintenanceToken(root)) return action();
  const file = path.join(root, ".sfmc", "maintenance.lock");
  await fs.mkdir(path.dirname(file), { recursive: true });
  const nonce = randomUUID();
  // 第一次遇到已退出持有者就删掉过期锁再抢；第二次仍失败则放弃，避免和正在创建的锁空转。
  for (let attempt = 0; attempt < 2; attempt++) {
    let handle;
    try { handle = await fs.open(file, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = await fs.readFile(file, "utf8").then(text => JSON.parse(text) as { pid: number }).catch(() => null);
      if (!owner || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw Object.assign(new Error("维护锁正在创建或已损坏；请稍后重试并核对任务状态"), { code: "locked" });
      if (lockOwnerAlive(owner.pid)) throw Object.assign(new Error("另一个管理操作正在执行"), { code: "locked" });
      // 持有进程已经没了。留下这把锁会让守护进程拒绝启动，界面一直停在「进行中」。
      await fs.unlink(file).catch(() => {});
      continue;
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
  throw Object.assign(new Error("维护锁正在创建或已损坏；请稍后重试并核对任务状态"), { code: "locked" });
}
