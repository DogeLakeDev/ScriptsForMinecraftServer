/**
 * terminal-progress.ts — 终端进度条与统一日志共存（DRY）
 *
 * 进度条本体绕过日志缓冲；日志 sink / REPL 写行前 pauseAll、写完 resumeAll。
 * 供 bds-updater、资源包 updater、未来 mod updater 共用。
 */

import type { WriteStream } from "node:tty";

export type ProgressLogFn = (message: string) => void;

export interface TerminalProgressOptions {
  /** 输出流（默认 process.stderr） */
  stream?: NodeJS.WritableStream;
  /** 非 TTY 时节流百分比日志 */
  logger?: ProgressLogFn;
  /** 非 TTY 步进百分比（默认 5） */
  stepPercent?: number;
  /** 强制开关；默认检测 stream.isTTY */
  forceBar?: boolean;
  format?: string;
  barCompleteChar?: string;
  barIncompleteChar?: string;
}

export interface ProgressHandle {
  start(total: number, startValue?: number, payload?: Record<string, string>): void;
  update(value: number, payload?: Record<string, string>): void;
  stop(): void;
  /** 当前是否已 start 且未 stop */
  readonly active: boolean;
}

interface ActiveEntry {
  id: number;
  pause: () => void;
  resume: () => void;
}

const active = new Map<number, ActiveEntry>();
let nextId = 1;
let pausedDepth = 0;

/** 是否有活跃进度条（含 pause 中） */
export function hasActiveProgress(): boolean {
  return active.size > 0;
}

/** 日志写行前：清掉进度条行 */
export function pauseAllProgress(): void {
  if (active.size === 0) return;
  pausedDepth++;
  if (pausedDepth !== 1) return;
  for (const e of active.values()) {
    try {
      e.pause();
    } catch {
      /* ignore */
    }
  }
}

/** 日志写行后：重绘进度条 */
export function resumeAllProgress(): void {
  if (active.size === 0) {
    pausedDepth = 0;
    return;
  }
  if (pausedDepth <= 0) return;
  pausedDepth--;
  if (pausedDepth !== 0) return;
  for (const e of active.values()) {
    try {
      e.resume();
    } catch {
      /* ignore */
    }
  }
}

/** 包裹一次会写终端的操作，避免与进度条抢行 */
export function withProgressPaused<T>(fn: () => T): T {
  pauseAllProgress();
  try {
    return fn();
  } finally {
    resumeAllProgress();
  }
}

function isWritableTty(stream: NodeJS.WritableStream): boolean {
  return !!(stream as WriteStream).isTTY;
}

/** 下载速度文案（BDS / CF 等共用，避免各处复制阈值分支） */
export function formatDownloadSpeed(bytesPerSec: number): string {
  const speed = Number.isFinite(bytesPerSec) ? Math.max(0, bytesPerSec) : 0;
  if (speed > 1024 * 1024) return `${(speed / 1024 / 1024).toFixed(1)} MB/s`;
  if (speed > 1024) return `${(speed / 1024).toFixed(1)} KB/s`;
  return `${speed.toFixed(0)} B/s`;
}

function renderBarLine(
  value: number,
  total: number,
  width: number,
  complete: string,
  incomplete: string,
  payload: Record<string, string>,
  format: string
): string {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const pct = Math.round(ratio * 100);
  const filled = Math.round(ratio * width);
  const bar = complete.repeat(filled) + incomplete.repeat(Math.max(0, width - filled));
  let out = format
    .replace("{bar}", bar)
    .replace("{percentage}", String(pct))
    .replace("{value}", value.toFixed(1).replace(/\.0$/, ""))
    .replace("{total}", safeTotal.toFixed(1).replace(/\.0$/, ""));
  for (const [k, v] of Object.entries(payload)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return out;
}

/**
 * 创建进度句柄。TTY 时画 bar；非 TTY 时按步进打 logger。
 */
export function createTerminalProgress(opts: TerminalProgressOptions = {}): ProgressHandle {
  const stream = opts.stream ?? process.stderr;
  const stepPercent = opts.stepPercent ?? 5;
  const format =
    opts.format ?? "进度 | {bar} | {percentage}% | {value}/{total} | {speed}";
  const barCompleteChar = opts.barCompleteChar ?? "\u2588";
  const barIncompleteChar = opts.barIncompleteChar ?? "\u2591";
  const useBar = opts.forceBar ?? isWritableTty(stream);

  let id = 0;
  let started = false;
  let stopped = false;
  let total = 0;
  let value = 0;
  let payload: Record<string, string> = { speed: "" };
  let lastLoggedPct = -1;
  let lastLine = "";

  function clearLine(): void {
    if (!useBar) return;
    stream.write("\r\x1B[K");
  }

  function draw(): void {
    if (!useBar || !started || stopped || pausedDepth > 0) return;
    const line = renderBarLine(value, total, 24, barCompleteChar, barIncompleteChar, payload, format);
    lastLine = line;
    stream.write(`\r\x1B[K${line}`);
  }

  function register(): void {
    id = nextId++;
    active.set(id, {
      id,
      pause: () => {
        if (!useBar || !started || stopped) return;
        clearLine();
      },
      resume: () => {
        if (!useBar || !started || stopped) return;
        if (lastLine) stream.write(`\r\x1B[K${lastLine}`);
        else draw();
      },
    });
  }

  function deregister(): void {
    if (id) active.delete(id);
    id = 0;
  }

  const handle: ProgressHandle = {
    get active() {
      return started && !stopped;
    },
    start(t, startValue = 0, p = {}) {
      stopped = false;
      total = t > 0 ? t : 1;
      value = startValue;
      payload = { speed: "", ...p };
      started = true;
      lastLoggedPct = -1;
      if (useBar) {
        if (!id) register();
        draw();
      } else if (opts.logger) {
        opts.logger(`进度 0% (0/${total})`);
        lastLoggedPct = 0;
      }
    },
    update(v, p) {
      if (!started || stopped) return;
      value = v;
      if (p) payload = { ...payload, ...p };
      if (useBar) {
        draw();
        return;
      }
      if (!opts.logger) return;
      const pct = total > 0 ? (value / total) * 100 : 0;
      const stepped = Math.floor(pct / stepPercent) * stepPercent;
      if (stepped !== lastLoggedPct && (stepped > lastLoggedPct || pct >= 100)) {
        lastLoggedPct = stepped;
        const speed = payload.speed ? ` ${payload.speed}` : "";
        opts.logger(
          `进度 ${Math.min(100, Math.round(pct))}% (${value.toFixed(1)}/${total.toFixed(1)})${speed}`
        );
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (useBar && started) {
        clearLine();
        if (lastLine) stream.write(`${lastLine}\n`);
      }
      deregister();
      started = false;
    },
  };

  return handle;
}

/** 在异步任务期间持有进度条，结束时保证 stop */
export async function withTerminalProgress<T>(
  opts: TerminalProgressOptions,
  run: (bar: ProgressHandle) => Promise<T>
): Promise<T> {
  const bar = createTerminalProgress(opts);
  try {
    return await run(bar);
  } finally {
    if (bar.active) bar.stop();
  }
}
