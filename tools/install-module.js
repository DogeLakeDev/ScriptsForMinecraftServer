#!/usr/bin/env node
/**
 * install-module.js — 模块安装/卸载工具（文件级）
 *
 * install <id>    确保模块文件在位（按 lock 快照检测 drift，可选择基于快照还原），
 *                  写入 modules/module-lock.json installed=true。
 * uninstall <id>  标记 installed=false，禁用，并把模块文件移动到 modules/.trash/<id>-<ts>/
 *                  （仅处理 catalog.files 列表与 entry.path 中属于仓库内的相对路径；
 *                   仓库外路径只更新 lock，不动文件）。
 * status          列出所有模块及安装/启用状态。
 *
 * 用法: node tools/install-module.js install <id> [--restore]
 *       node tools/install-module.js uninstall <id> [--dry-run]
 *       node tools/install-module.js status
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  loadModuleLock: readModuleLock,
  saveModuleLock: writeModuleLock,
  isInstalled,
  updateModuleState,
} = require("../db-server/lib/module-state");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "modules", "catalog.json");
const MODULE_LOCK = path.join(ROOT, "modules", "module-lock.json");
const FILE_LOCK = path.join(ROOT, "modules", "lock.json");
const TRASH_DIR = path.join(ROOT, "modules", ".trash");

function loadCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, "utf-8"));
}

function loadModuleLock() {
  return readModuleLock(MODULE_LOCK);
}

function saveModuleLock(lock) {
  writeModuleLock(MODULE_LOCK, lock);
}

function loadFileLock() {
  if (!fs.existsSync(FILE_LOCK)) return null;
  return JSON.parse(fs.readFileSync(FILE_LOCK, "utf-8"));
}

function saveFileLock(lock) {
  fs.mkdirSync(path.dirname(FILE_LOCK), { recursive: true });
  fs.writeFileSync(FILE_LOCK, JSON.stringify(lock, null, 2) + "\n");
}

function rebuildFileLock() {
  const res = spawnSync(process.execPath, [path.join(__dirname, "lock.js"), "rebuild"], { cwd: ROOT, encoding: "utf-8" });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    process.exit(1);
  }
}

function findModule(catalog, id) {
  return catalog.modules.find((m) => m.id === id || m.configKey === id);
}

function listFiles(mod) {
  const files = [];
  if (mod.entry && mod.entry.path) files.push(mod.entry.path);
  if (Array.isArray(mod.files)) files.push(...mod.files);
  return Array.from(new Set(files));
}

function isRepoPath(rel) {
  // 安全约束：只允许相对仓库根的路径，且不得越级
  if (typeof rel !== "string" || !rel) return false;
  if (path.isAbsolute(rel)) return false;
  const norm = path.normalize(rel);
  if (norm.startsWith("..") || path.isAbsolute(norm)) return false;
  return true;
}

function moveToTrash(mod, dryRun) {
  const files = listFiles(mod).filter(isRepoPath);
  if (files.length === 0) return { moved: [], missing: [] };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(TRASH_DIR, `${mod.id}-${stamp}`);
  const moved = [];
  const missing = [];
  if (!dryRun) fs.mkdirSync(dest, { recursive: true });
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) { missing.push(rel); continue; }
    const target = path.join(dest, rel);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(src, target);
    }
    moved.push(rel);
  }
  return { moved, missing, trashDir: dest };
}

function restoreFromTrash(mod, trashDir) {
  for (const rel of listFiles(mod).filter(isRepoPath)) {
    const src = path.join(trashDir, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
  }
  fs.rmSync(trashDir, { recursive: true, force: true });
}

function ensureLock() {
  const lock = loadModuleLock();
  if (!lock.modules) lock.modules = {};
  return lock;
}

function install(id, opts) {
  const cat = loadCatalog();
  const mod = findModule(cat, id);
  if (!mod) { console.error(`未找到模块: ${id}`); process.exit(1); }
  const lock = ensureLock();
  const prev = lock.modules[mod.id] || {};

  // 依赖校验：requires 中每个都需 installed
  for (const depId of mod.requires || []) {
    const dep = findModule(cat, depId);
    if (!dep) continue;
    const depInstalled = isInstalled(lock, dep.id, false);
    if (!depInstalled) {
      console.error(`[install] 依赖未安装: ${dep.id}`);
      process.exit(2);
    }
  }

  // 文件校验：drift 检测
  rebuildFileLock();
  const fileLock = loadFileLock();
  const fp = fileLock?.modules?.[mod.id];
  if (fp && Array.isArray(fp.files)) {
    const drift = [];
    for (const f of fp.files) {
      const full = path.join(ROOT, f.path);
      if (!fs.existsSync(full)) { drift.push(`${f.path} (缺失)`); continue; }
      const content = fs.readFileSync(full);
      const stat = fs.statSync(full);
      const meta = `${f.path}|${stat.mtimeMs}|${stat.size}`;
      const h = require("node:crypto").createHash("sha1");
      h.update(meta); h.update(content);
      const cur = h.digest("hex").slice(0, 16);
      if (cur !== f.hash) drift.push(`${f.path} (改动)`);
    }
    if (drift.length > 0) {
      console.warn(`[install] 检测到 ${mod.id} 文件 drift:`);
      for (const d of drift) console.warn(`  - ${d}`);
      if (opts.restore) {
        // 暂不实现完整还原：仅提示用户用 git checkout 或备份恢复
        console.warn(`[install] --restore 暂未启用，建议: git checkout -- <file>`);
      }
    }
  }

  updateModuleState(lock, mod.id, { installed: true });
  saveModuleLock(lock);
  console.log(`[install] ${mod.id} 已安装`);
  console.log(`提示: 请执行 npm run build 并重启 BDS 生效`);
}

function uninstall(id, opts) {
  const cat = loadCatalog();
  const mod = findModule(cat, id);
  if (!mod) { console.error(`未找到模块: ${id}`); process.exit(1); }
  if (!mod.canUninstall) { console.error(`${mod.id} 不可卸载 (canUninstall=false)`); process.exit(1); }

  const lock = ensureLock();
  // 反向依赖校验：被已安装模块引用则不能卸载
  for (const other of cat.modules) {
    if (other.id === mod.id) continue;
    if (!(other.requires || []).includes(mod.id)) continue;
    const otherInstalled = isInstalled(lock, other.id, false);
    if (otherInstalled) {
      console.error(`[uninstall] 被已安装模块引用: ${other.id}`);
      process.exit(2);
    }
  }

  const prev = lock.modules[mod.id] || {};
  const result = opts.noFiles ? { moved: [], missing: [] } : moveToTrash(mod, opts.dryRun);

  updateModuleState(lock, mod.id, {
    installed: false,
    enabled: false,
    lastUninstalledAt: Date.now(),
    trashDir: opts.dryRun || opts.noFiles ? null : (result.trashDir ? path.relative(ROOT, result.trashDir) : null),
  });
  saveModuleLock(lock);

  if (opts.dryRun) {
    console.log(`[dry-run] 计划移动 ${result.moved.length} 个文件到 trash`);
  } else {
    console.log(`[uninstall] ${mod.id} 已卸载`);
    console.log(`  moved: ${result.moved.length}`);
    if (result.missing.length) console.log(`  missing: ${result.missing.length} (${result.missing.slice(0, 3).join(", ")}${result.missing.length > 3 ? "..." : ""})`);
    console.log(`  trash: ${lock.modules[mod.id].trashDir}`);
  }
  console.log(`提示: 请执行 npm run build 并重启 BDS 生效`);
}

function status() {
  const cat = loadCatalog();
  const lock = loadModuleLock();
  for (const m of cat.modules) {
    const s = lock.modules?.[m.id] || {};
    const installed = s.installed === true;
    console.log(`${installed ? "[√]" : "[ ]"} ${m.id.padEnd(28)} type=${m.type.padEnd(8)} installed=${installed}`);
  }
}

function help() {
  console.log("用法:");
  console.log("  install <id> [--restore]");
  console.log("  uninstall <id> [--dry-run] [--no-files]");
  console.log("  status");
}

const cmd = process.argv[2];
const id = process.argv[3];
const flags = new Set(process.argv.slice(4));
if (cmd === "install" && id) install(id, { restore: flags.has("--restore") });
else if (cmd === "uninstall" && id) uninstall(id, { dryRun: flags.has("--dry-run"), noFiles: flags.has("--no-files") });
else if (cmd === "status") status();
else help();
