/**
 * log-buffer.js — 节流日志 buffer + 文件持久化
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVEL_PREFIX } from './theme.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const logBuf = [];
const logFns = new Set();
let flushTimer = null;
let flushDirty = false;
let _logFile = null;

function ensureLogFile() {
  if (_logFile) return _logFile;
  try {
    const p = path.join(ROOT_DIR, 'panel', '.panel.log');
    _logFile = fs.createWriteStream(p, { flags: 'a' });
    return _logFile;
  } catch { return null; }
}

function flushLogs() {
  flushTimer = null;
  if (!flushDirty) return;
  flushDirty = false;
  for (const fn of logFns) fn();
}

function pushLog(msg, level = 'info', source) {
  const prefix = LEVEL_PREFIX[level] || '[*]';
  const text = `${prefix} ${msg}`;
  logBuf.push({ level, text, source });
  if (logBuf.length > 500) {
    const flushed = logBuf.splice(0, logBuf.length - 500);
    const f = ensureLogFile();
    if (f) {
      for (const l of flushed) f.write(l.text + '\n');
      _rotateLogIfNeeded(f);
    }
  }
  flushDirty = true;
  if (!flushTimer) flushTimer = setTimeout(flushLogs, 16);
}

const MAX_LOG_FILE = 1024 * 1024; // 1 MB
const KEEP_LOG_TAIL = 64 * 1024;  // 保留末 64 KB

function _rotateLogIfNeeded(f) {
  try {
    const size = fs.statSync(f.path).size;
    if (size <= MAX_LOG_FILE) return;
    // 截断：保留末尾 KEEP_LOG_TAIL 字节
    const fd = fs.openSync(f.path, 'r+');
    const buf = Buffer.alloc(KEEP_LOG_TAIL);
    const bytesRead = fs.readSync(fd, buf, 0, KEEP_LOG_TAIL, size - KEEP_LOG_TAIL);
    fs.ftruncateSync(fd, 0);
    fs.writeSync(fd, buf, 0, bytesRead);
    fs.closeSync(fd);
  } catch { /* 轮转失败不影响主流程 */ }
}

function closeLogFile() {
  if (!_logFile) return;
  try { _logFile.end(); } catch {}
  _logFile = null;
}

export { logBuf, logFns, pushLog, flushLogs, closeLogFile };

