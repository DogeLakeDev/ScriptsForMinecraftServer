#!/usr/bin/env node
/**
 * modules-lock.json — 每个模块的文件指纹快照
 *
 * 字段:
 *  - version: 锁文件版本
 *  - generatedAt: 生成时间戳
 *  - modules: { [id]: { version, hash, files: [{ path, hash }], updatedAt } }
 *
 * 算法:
 *  - 单文件 hash = sha1(相对路径 + mtimeMs + size)
 *  - 模块 hash = sha1(所有 files hash 拼接)
 *
 * 用于 detect 模块文件 drift / 卸载前快照。
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const LOCK = path.join(ROOT, "modules", "lock.json");
const CATALOG = path.join(ROOT, "modules", "catalog.json");

function hashFile(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    const st = fs.statSync(full);
    const buf = fs.readFileSync(full);
    const meta = `${relPath}|${st.mtimeMs}|${st.size}`;
    const h = crypto.createHash("sha1");
    h.update(meta);
    h.update(buf);
    return h.digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

function loadCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, "utf-8"));
}

function loadLock() {
  if (!fs.existsSync(LOCK)) return { version: 1, modules: {} };
  return JSON.parse(fs.readFileSync(LOCK, "utf-8"));
}

function saveLock(lock) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
}

function resolveFiles(mod) {
  const files = [];
  if (mod.entry && mod.entry.path) files.push(mod.entry.path);
  if (Array.isArray(mod.files)) files.push(...mod.files);
  return Array.from(new Set(files));
}

function fingerprintModule(mod) {
  const files = resolveFiles(mod);
  const entries = [];
  const h = crypto.createHash("sha1");
  for (const rel of files) {
    const fh = hashFile(rel);
    if (fh === null) continue;
    entries.push({ path: rel, hash: fh });
    h.update(fh);
  }
  return { files: entries, hash: h.digest("hex").slice(0, 16) };
}

function rebuildLock() {
  const cat = loadCatalog();
  const lock = loadLock();
  const next = { version: 1, generatedAt: Date.now(), modules: {} };
  for (const m of cat.modules) {
    const fp = fingerprintModule(m);
    next.modules[m.id] = {
      version: m.version || "1.0.0",
      hash: fp.hash,
      files: fp.files,
      updatedAt: Date.now(),
    };
  }
  saveLock(next);
  console.log(`[lock] 重新生成 (${Object.keys(next.modules).length} 模块)`);
}

function detectDrift() {
  const cat = loadCatalog();
  const lock = loadLock();
  const drift = [];
  for (const m of cat.modules) {
    const fp = fingerprintModule(m);
    const prev = lock.modules[m.id];
    if (!prev) {
      drift.push({ id: m.id, reason: "missing" });
      continue;
    }
    if (prev.hash !== fp.hash) drift.push({ id: m.id, reason: "hash-mismatch" });
  }
  if (drift.length === 0) {
    console.log("[lock] 无 drift");
  } else {
    for (const d of drift) console.log(`[lock] DRIFT: ${d.id} (${d.reason})`);
    process.exit(2);
  }
}

const cmd = process.argv[2] || "rebuild";
if (cmd === "rebuild") rebuildLock();
else if (cmd === "drift") detectDrift();
else {
  console.error(`未知命令: ${cmd}（支持: rebuild | drift）`);
  process.exit(1);
}