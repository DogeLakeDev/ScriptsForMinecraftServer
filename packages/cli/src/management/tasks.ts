import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { lockOwnerAlive, withMaintenanceLock } from "@sfmc-bds/management/node";
import { toManagementError, type OperationRecord } from "@sfmc-bds/management";

export function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temp, file);
}
export type TaskContext = { phase: (name: string, message?: string) => void; id: string };

/** 任务属于守护进程而非 SSH 会话；异常恢复只标记，不重放写入。 */
export class TaskStore extends EventEmitter {
  private queue: Promise<unknown> = Promise.resolve();
  private directory: string;
  constructor(private root: string) {
    super();
    this.directory = path.join(root, ".sfmc", "operations");
    fs.mkdirSync(this.directory, { recursive: true });
    for (const record of this.list()) {
      if (record.status === "queued" || record.status === "running") {
        const pid = (record as OperationRecord & { workerPid?: number }).workerPid;
        // 与维护锁同一套探活：权限不足不算退出，避免把还在跑的维护进程标成中断。
        const active = typeof pid === "number" && lockOwnerAlive(pid);
        if (!active) { record.status = "interrupted"; record.error = { code: "unavailable", message: "执行进程异常退出；请检查备份与实际状态，任务不会自动重发" }; this.save(record); }
      }
    }
  }
  get(id: string): OperationRecord {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("非法任务编号");
    return JSON.parse(fs.readFileSync(path.join(this.directory, `${id}.json`), "utf8")) as OperationRecord;
  }
  list(): OperationRecord[] {
    return fs.readdirSync(this.directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).flatMap(name => {
      try { const record = JSON.parse(fs.readFileSync(path.join(this.directory, name), "utf8")) as OperationRecord; return typeof record.createdAt === "string" && Array.isArray(record.phases) ? [record] : []; } catch { return []; }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  }
  save(record: OperationRecord) {
    record.updatedAt = new Date().toISOString();
    atomicJson(path.join(this.directory, `${record.id}.json`), record);
    this.emit("operation", record);
  }
  submit(kind: string, action: (context: TaskContext) => Promise<unknown>) {
    const record: OperationRecord = { id: randomUUID(), kind, title: kind, status: "queued", phases: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.save(record);
    this.queue = this.queue.catch(() => {}).then(async () => {
      try {
        await withMaintenanceLock(this.root, async () => {
          record.status = "running"; this.save(record);
          const phase = (name: string, message?: string) => {
            const previous = record.phases.at(-1);
            if (previous?.status === "running") { previous.status = "done"; previous.finishedAt = new Date().toISOString(); }
            record.phases.push({ name, status: "running", startedAt: new Date().toISOString(), ...(message ? { message } : {}) }); this.save(record);
          };
          record.result = await action({ phase, id: record.id });
          // 独立维护进程接管记录之后，守护进程不再覆盖其状态。
          if ((record.result as { detached?: boolean } | undefined)?.detached) return;
          const last = record.phases.at(-1); if (last) { last.status = "done"; last.finishedAt = new Date().toISOString(); }
          record.status = "succeeded"; this.save(record);
        });
      } catch (error) {
        record.status = "failed"; record.error = toManagementError(error);
        const last = record.phases.at(-1); if (last) last.status = "failed";
        this.save(record);
      }
    });
    return { operationId: record.id };
  }
}
