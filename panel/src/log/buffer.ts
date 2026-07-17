/**
 * log/buffer.ts — 日志条目收集与持久化
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Level } from "../theme.js";
import { set } from "../store.js";
import type { LogEntry } from "../store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

const MAX_BUFFER = 1000;
const MAX_FILE_BYTES = 1024 * 1024;
const KEEP_TAIL_BYTES = 64 * 1024;

let _seq = 0;
let _file: fs.WriteStream | null = null;
let _dirty = false;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function ensureFile(): fs.WriteStream | null {
  if (_file) return _file;
  try {
    _file = fs.createWriteStream(path.join(ROOT_DIR, "panel", ".panel.log"), { flags: "a" });
    return _file;
  } catch {
    return null;
  }
}

function rotateIfNeeded(): void {
  const f = _file;
  if (!f) return;
  try {
    const p = path.join(ROOT_DIR, "panel", ".panel.log");
    const size = fs.statSync(p).size;
    if (size <= MAX_FILE_BYTES) return;
    const fd = fs.openSync(p, "r+");
    const buf = Buffer.alloc(KEEP_TAIL_BYTES);
    const read = fs.readSync(fd, buf, 0, KEEP_TAIL_BYTES, size - KEEP_TAIL_BYTES);
    fs.ftruncateSync(fd, 0);
    fs.writeSync(fd, buf, 0, read);
    fs.closeSync(fd);
  } catch {
    /* non-fatal */
  }
}

function flushNow(): void {
  _flushTimer = null;
  if (!_dirty) return;
  _dirty = false;
}

export function pushLog(text: string, level: Level = "info", source?: string): void {
  const entry: LogEntry = { id: ++_seq, time: Date.now(), level, text };
  if (source !== undefined) entry.source = source;
  set((s) => {
    const next = s.logs.concat(entry);
    const overflow = Math.max(0, next.length - MAX_BUFFER);
    let trimmed = next;
    if (overflow > 0) {
      trimmed = next.slice(overflow);
      const f = ensureFile();
      if (f) {
        for (let i = 0; i < overflow; i++) {
          const e = next[i];
          if (e) f.write(`${new Date(e.time).toISOString()} [${e.level}] ${e.text}\n`);
        }
        rotateIfNeeded();
      }
    }
    return { logs: trimmed, logScroll: 0 };
  });
  _dirty = true;
  if (!_flushTimer) _flushTimer = setTimeout(flushNow, 32);
}

export function bindServiceOutput(
  services: Record<string, { name: string; title: string; events: { on: (e: string, fn: (text: string, level?: Level) => void) => void } }>,
): void {
  for (const svc of Object.values(services)) {
    svc.events.on("output", (text: string, level: Level = "info") => {
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t) pushLog(t, level, svc.name);
      }
    });
  }
}

export function closeLogFile(): void {
  if (_file) {
    try {
      _file.end();
    } catch {
      /* ignore */
    }
    _file = null;
  }
}
