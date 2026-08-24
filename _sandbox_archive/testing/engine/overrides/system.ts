/**
 * 假 system：run / runTimeout / runInterval + 可 tick 推进；事件 hub 1:1 惰性。
 */

import { createEventHub, createEventSignal, type EventSignal } from "./events.js";
import { guardUnimplemented } from "../unimplemented-error.js";

type Scheduled = {
  id: number;
  kind: "run" | "timeout" | "interval";
  cb: () => void;
  dueTick: number;
  intervalTicks?: number;
};

export type FakeSystem = {
  afterEvents: Record<string, EventSignal<unknown>>;
  beforeEvents: Record<string, EventSignal<unknown>>;
  currentTick: number;
  /** 沙箱非编辑器世界 */
  readonly isEditorWorld: boolean;
  run(cb: () => void, ticks?: number): number;
  runTimeout(cb: () => void, ticks?: number): number;
  runInterval(cb: () => void, ticks?: number): number;
  clearRun(id: number): void;
  waitTicks(ticks: number): Promise<void>;
  tick(n?: number): void;
  flush(): void;
  reset(): void;
};

export function createFakeSystem(): FakeSystem {
  let nextId = 1;
  let currentTick = 0;
  const jobs = new Map<number, Scheduled>();

  const afterEvents = createEventHub<unknown>({
    scriptEventReceive: createEventSignal(),
  });
  const beforeEvents = createEventHub<unknown>({
    startup: createEventSignal(),
    shutdown: createEventSignal(),
    watchdogTerminate: createEventSignal(),
  });

  const runAt = (kind: Scheduled["kind"], cb: () => void, ticks: number, intervalTicks?: number) => {
    const id = nextId++;
    const job: Scheduled = {
      id,
      kind,
      cb,
      dueTick: currentTick + Math.max(0, ticks),
    };
    if (intervalTicks !== undefined) job.intervalTicks = intervalTicks;
    jobs.set(id, job);
    return id;
  };

  const drainDue = () => {
    const due = [...jobs.values()].filter((j) => j.dueTick <= currentTick).sort((a, b) => a.id - b.id);
    for (const job of due) {
      if (!jobs.has(job.id)) continue;
      try {
        job.cb();
      } catch {
        /* 吞掉任务异常 */
      }
      if (job.kind === "interval" && job.intervalTicks !== undefined && jobs.has(job.id)) {
        job.dueTick = currentTick + Math.max(1, job.intervalTicks);
      } else {
        jobs.delete(job.id);
      }
    }
  };

  const api: FakeSystem = {
    afterEvents,
    beforeEvents,
    get currentTick() {
      return currentTick;
    },
    isEditorWorld: false,
    run(cb, ticks = 0) {
      return runAt("run", cb, ticks);
    },
    runTimeout(cb, ticks = 1) {
      return runAt("timeout", cb, ticks);
    },
    runInterval(cb, ticks = 1) {
      return runAt("interval", cb, Math.max(1, ticks), Math.max(1, ticks));
    },
    clearRun(id) {
      jobs.delete(id);
    },
    waitTicks(ticks) {
      return new Promise((resolve) => {
        runAt("timeout", () => resolve(), ticks);
      });
    },
    tick(n = 1) {
      const steps = Math.max(0, n);
      for (let i = 0; i < steps; i++) {
        currentTick += 1;
        drainDue();
      }
    },
    flush() {
      let guard = 0;
      while (guard++ < 1000) {
        const immediate = [...jobs.values()].filter((j) => j.dueTick <= currentTick);
        if (immediate.length === 0) break;
        drainDue();
      }
    },
    reset() {
      // 只清调度队列；保留 scriptEvent 等平台级订阅（Command.registerScriptEvent）。
      jobs.clear();
      currentTick = 0;
      nextId = 1;
    },
  };

  return guardUnimplemented(api, "system") as FakeSystem;
}
