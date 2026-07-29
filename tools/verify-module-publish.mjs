#!/usr/bin/env node
/**
 * tools/verify-module-publish.mjs — 模块包发布前的全方位预检
 *
 * 在 `sfmc mod publish` 真跑 npm 之前跑一遍；CI 也可触发。
 * 集成 `sfmc mod publish --dry-run` 的同一套检查，但更深：
 *
 * 1) manifest v2 字段完整性（id / configKey / permissions / services）
 * 2) package.json#name 与 manifest.id 一致（折叠规则：feature-* → folder）
 * 3) package.json#files 含 sapi/（避免发空 tarball）
 * 4) npm pack --dry-run 解析 tarball 清单（确认 sapi/ 实际入包）
 * 5) sapi/src/** 至少 1 个 .ts 文件，且含 ModuleRegistry.register 调用
 * 6) sdk 依赖 pin 在 @sfmc-bds/sdk（避免拼错 @sfmc/sdk 旧名）
 * 7) 跨模块源码 import 检查（避免深挖其它模块业务代码）
 *
 * 退出码：0 全部通过；1 任一项失败。失败时打印每条 cause + 修复建议。
 *
 * 单一权威：与 sfmc/src/module-publish.ts#runPrecheck 互补（CLI 提供 dry-run 摘要，
 * 本脚本提供可独立运行的硬预检 + 更深字段校验）。
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const CWD = process.cwd();

function die(msg, code = 1) {
  console.error(`[verify-module-publish] ${msg}`);
  process.exit(code);
}

const KEYS = {
  schemaVersion: 2,
  required: ["id", "name", "type", "configKey", "permissions", "services", "requires"],
};

const checks = [];
let pass = 0;
let warn = 0;
let fail = 0;

function record(kind, name, msg) {
  checks.push({ kind, name, msg });
  if (kind === "pass") pass++;
  else if (kind === "warn") warn++;
  else fail++;
}

/* ──────────────────────────────────────────────────────────────────
 * 1) manifest.json v2 字段完整性
 * ──────────────────────────────────────────────────────────────── */
async function checkManifest() {
  const manifestPath = path.join(CWD, "sapi", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    record("fail", "manifest 存在", `未找到 sapi/manifest.json（在 ${CWD}）`);
    return null;
  }
  let manifest;
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  } catch (e) {
    record("fail", "manifest 可解析", `sapi/manifest.json 解析失败: ${e.message}`);
    return null;
  }
  if (manifest.schemaVersion !== KEYS.schemaVersion) {
    record("fail", "schemaVersion=2", `当前 ${manifest.schemaVersion ?? "未设置"}；固定为 2`);
  } else {
    record("pass", "schemaVersion=2", "OK");
  }
  for (const k of KEYS.required) {
    if (manifest[k] === undefined) {
      record("fail", `manifest.${k}`, `缺失`);
    } else {
      record("pass", `manifest.${k}`, "存在");
    }
  }
  if (manifest.services && typeof manifest.services === "object") {
    if (!Array.isArray(manifest.services.provides)) {
      record("fail", "manifest.services.provides 数组", `当前类型 ${typeof manifest.services.provides}`);
    }
    if (!Array.isArray(manifest.services.requires)) {
      record("fail", "manifest.services.requires 数组", `当前类型 ${typeof manifest.services.requires}`);
    } else {
      const refs = manifest.services.requires.map((r) => (r && typeof r === "object" ? r.name : r));
      const dup = refs.filter((n, i) => refs.indexOf(n) !== i);
      if (dup.length) record("fail", "manifest.services.requires 无重复", `重复: ${[...new Set(dup)].join(", ")}`);
    }
  }
  return manifest;
}

/* ──────────────────────────────────────────────────────────────────
 * 2) package.json#name 与 manifest.id 折叠一致
 *    folder              → @scope/module-<folder>
 *    feature-<folder>    → 同上
 * ──────────────────────────────────────────────────────────────── */
function folderFromManifest(manifest) {
  const id = manifest?.id;
  if (!id) return null;
  if (id.startsWith("feature-") || id.startsWith("core-")) return id.slice(id.indexOf("-") + 1);
  return id;
}

async function checkPackageNameAlignment(manifest) {
  const pkgPath = path.join(CWD, "package.json");
  if (!fs.existsSync(pkgPath)) {
    record("fail", "package.json 存在", "未找到 package.json");
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
  } catch (e) {
    record("fail", "package.json 可解析", e.message);
    return;
  }
  const expectedFolder = folderFromManifest(manifest);
  if (!expectedFolder) return; /* checkManifest 已报缺 id */
  /* 接受 @<scope>/module-<folder> 或 @<scope>/sfmc-module-<folder> */
  const re = new RegExp(`^@[^/]+/(?:sfmc-)?module-${expectedFolder}$`);
  if (!re.test(pkg.name ?? "")) {
    record(
      "fail",
      "package.name 与 manifest.id 一致",
      `name=${pkg.name}，期望匹配 ${re}（folder=${expectedFolder}）`
    );
  } else {
    record("pass", "package.name 与 manifest.id 一致", pkg.name);
  }
  /* version */
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pkg.version ?? "")) {
    record("fail", "package.version semver", `当前 ${pkg.version}`);
  } else {
    record("pass", "package.version semver", pkg.version);
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 3) package.json#files 含 sapi/
 * ──────────────────────────────────────────────────────────────── */
async function checkFilesField() {
  const pkgPath = path.join(CWD, "package.json");
  if (!fs.existsSync(pkgPath)) {
    record("fail", "package.files 数组", "未找到 package.json");
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
  } catch {
    return; /* 已在 checkPackageNameAlignment 报 */
  }
  const files = pkg.files;
  if (!Array.isArray(files)) {
    record("fail", "package.files 数组", `未声明 files；npm pack 会按 .gitignore 默认 → tarball 可能不含 sapi/`);
    return;
  }
  if (!files.includes("sapi")) {
    record("fail", "package.files 含 sapi/", `当前 ${JSON.stringify(files)}`);
  } else {
    record("pass", "package.files 含 sapi/", "OK");
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 4) npm pack --dry-run 解析 tarball 内容
 * ──────────────────────────────────────────────────────────────── */
/* 极简 tar 头解析：512-byte 块，name 在 offset 0（100 字节 null-padded），
 * size 在 offset 124（12 字节八进制 null-padded）；typeflag 在 offset 156（'0' = 普通文件，'5' = 目录）。
 * 末尾两个全零 512 块终止。返回 entries 名字数组（相对 tar 根，含目录与文件）。 */
function listTarEntries(buf) {
  const files = [];
  const BLOCK = 512;
  for (let off = 0; off + BLOCK <= buf.length; off += BLOCK) {
    const header = buf.subarray(off, off + BLOCK);
    /* name 是 null 结尾 */
    const nameEnd = header.indexOf(0);
    if (nameEnd < 0) break; /* 全零块，终止 */
    const name = header.subarray(0, nameEnd).toString("utf8");
    /* size 是 octal 字符串 */
    const sizeStr = header.subarray(124, 136).toString("utf8").replace(/\0/g, "").trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeflag = String.fromCharCode(header[156]);
    if (name === "") break;
    if (typeflag !== "5") files.push(name); /* 跳过纯目录 */
    /* size blocks + 1 header */
    off += Math.ceil(size / BLOCK) * BLOCK;
  }
  return files;
}

function runNpm(args) {
  const isWin = process.platform === "win32";
  const npmCli = path.join(process.execPath.replace(/[^\\/]+$/, ""), "node_modules", "npm", "bin", "npm-cli.js");
  if (isWin && fs.existsSync(npmCli)) {
    return new Promise((resolve) => {
      const proc = spawn(process.execPath, [npmCli, ...args], {
        cwd: CWD,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, npm_config_loglevel: "notice" },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.stderr?.on("data", (d) => (stderr += d.toString()));
      proc.on("exit", (code) => {
        /* npm 11+ notice 输出到 stderr、tgz 文件名输出到 stdout；
         * 合并时 stderr 放前，让 stdout 的 tgz 文件名落在最后一行（pop 可得）。 */
        const merged = stderr + stdout;
        resolve({ code, stdout: merged, stderr });
      });
      proc.on("error", (e) => resolve({ code: -1, stdout: "", stderr: e.message }));
    });
  }
  return new Promise((resolve) => {
    const proc = spawn("npm", args, { cwd: CWD, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("exit", (code) => resolve({ code, stdout: stdout + stderr, stderr }));
    proc.on("error", (e) => resolve({ code: -1, stdout: "", stderr: e.message }));
  });
}

async function checkTarballContents() {
  const os = await import("node:os");
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "sfmc-vm-tgz-"));
  try {
    const r = await runNpm(["pack"]);
    if (process.env.VERIFY_DEBUG) console.error("[debug] npm pack code=", r.code, "stdout=", JSON.stringify(r.stdout));
    if (r.code !== 0) {
      record("fail", "npm pack 成功", r.stderr.trim() || `exit ${r.code}`);
      return;
    }
    const tgzName = r.stdout.trim().split(/\r?\n/).pop() ?? "";
    const tgzPath = path.join(CWD, tgzName);
    if (!tgzName || !fs.existsSync(tgzPath)) {
      record("fail", "tarball 生成", `未找到产物: cwd=${CWD}, stdout=${r.stdout.trim().split("\n").slice(-3).join(" | ")}`);
      return;
    }
    const buffer = await fsp.readFile(tgzPath);
    /* npm pack 产物是 .tar.gz（不是 zip）。用 zlib 解 gzip + 极简 tar 头解析。 */
    const zlib = await import("node:zlib");
    const decompressed = zlib.gunzipSync(buffer);
    const files = listTarEntries(decompressed);
    if (files.length === 0) {
      record("fail", "tarball 含文件", `tgz 大小 ${buffer.length}B 但无 entries`);
      return;
    }
    record("pass", "tarball 含文件", `${files.length} 文件入包`);
    const must = ["package.json", "sapi/manifest.json"];
    for (const f of must) {
      if (!files.some((t) => t === `package/${f}` || t === f)) {
        record("fail", `tarball 含 ${f}`, `缺失；当前前 5 个: ${files.slice(0, 5).join(", ")}`);
      } else {
        record("pass", `tarball 含 ${f}`, "OK");
      }
    }
    const srcFiles = files.filter((f) => f.includes("sapi/src/"));
    if (srcFiles.length === 0) {
      record("warn", "tarball 含 sapi/src/**", "无源码文件；模块可能空跑");
    } else {
      record("pass", "tarball 含 sapi/src/**", `${srcFiles.length} 文件`);
    }
  } finally {
    /* 清理 CWD 下的临时 tgz（npm pack 写到这里） */
    try {
      for (const e of fs.readdirSync(CWD)) {
        if (e.endsWith(".tgz") && e.includes("module")) {
          try { fs.unlinkSync(path.join(CWD, e)); } catch {}
        }
      }
    } catch {}
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 5) sapi/src/** 至少 1 个 .ts，且含 ModuleRegistry.register 调用
 * ──────────────────────────────────────────────────────────────── */
async function checkEntryRegistration() {
  const srcDir = path.join(CWD, "sapi", "src");
  if (!fs.existsSync(srcDir)) {
    record("fail", "sapi/src/ 存在", `未找到目录 ${srcDir}`);
    return;
  }
  const tsFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.tsx?$/.test(e.name)) tsFiles.push(p);
    }
  };
  walk(srcDir);
  if (tsFiles.length === 0) {
    record("fail", "sapi/src 含 .ts", "无");
    return;
  }
  let hasRegister = false;
  for (const f of tsFiles) {
    const text = await fsp.readFile(f, "utf8");
    if (/ModuleRegistry\.register\s*\(/.test(text)) {
      hasRegister = true;
      break;
    }
  }
  if (!hasRegister) {
    record("fail", "至少一个 .ts 含 ModuleRegistry.register", "全部命中不到；模块不会被 BP 装载");
  } else {
    record("pass", "sapi/src 含 ModuleRegistry.register", "OK");
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 6) sdk 依赖 pin 正确
 * ──────────────────────────────────────────────────────────────── */
async function checkSdkPin() {
  const pkgPath = path.join(CWD, "package.json");
  if (!fs.existsSync(pkgPath)) {
    record("fail", "无 @sfmc/sdk 旧别名", "未找到 package.json");
    record("fail", "声明 @sfmc-bds/sdk 依赖", "未找到 package.json");
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
  } catch {
    return; /* 已在前面报 */
  }
  const sections = ["dependencies", "devDependencies", "peerDependencies"];
  const issues = [];
  for (const s of sections) {
    const deps = pkg[s] ?? {};
    if (deps["@sfmc/sdk"]) issues.push(`${s}.@sfmc/sdk（旧别名）`);
  }
  if (issues.length) {
    record("fail", "无 @sfmc/sdk 旧别名", `发现 ${issues.join(", ")}`);
  } else {
    record("pass", "无 @sfmc/sdk 旧别名", "OK");
  }
  const sdkVer = pkg.dependencies?.["@sfmc-bds/sdk"] ?? pkg.devDependencies?.["@sfmc-bds/sdk"] ?? pkg.peerDependencies?.["@sfmc-bds/sdk"];
  if (!sdkVer) {
    record("fail", "声明 @sfmc-bds/sdk 依赖", `未在 dependencies/devDependencies/peerDependencies 声明`);
  } else {
    record("pass", "声明 @sfmc-bds/sdk 依赖", `version=${sdkVer}`);
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 7) 跨模块源码 import 检查（不要 import 其它模块私有代码）
 *    启发式：@sfmc-bds/module-* 以外的相对 ../ 深挖一律警告
 * ──────────────────────────────────────────────────────────────── */
async function checkCrossModuleImports() {
  const srcDir = path.join(CWD, "sapi", "src");
  if (!fs.existsSync(srcDir)) return;
  const tsFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) tsFiles.push(p);
    }
  };
  walk(srcDir);
  /* 启发式规则：
   *   - 允许：import "@sfmc-bds/sdk/..." 与 "node:*"
   *   - 警告：相对路径超过 2 级 (../../..)
   *   - 警告：import 含 "module-" 但非 "@sfmc-bds/module-<id>" 自身
   */
  for (const f of tsFiles) {
    const text = await fsp.readFile(f, "utf8");
    const matches = text.matchAll(/from\s+["']([^"']+)["']/g);
    for (const m of matches) {
      const spec = m[1];
      if (spec.startsWith("@sfmc-bds/sdk")) continue;
      if (spec.startsWith("node:")) continue;
      if (spec.startsWith("@minecraft/")) continue;
      if (spec.startsWith(".")) {
        const upLevels = (spec.match(/\.\.\//g) || []).length;
        if (upLevels >= 2) {
          record("warn", `${path.relative(CWD, f)} 相对深挖`, `${spec}（${upLevels} 级；建议改用 typed client）`);
        }
      }
      if (spec.includes("module-") && !spec.startsWith(".")) {
        record("warn", `${path.relative(CWD, f)} 引用未授权模块`, `${spec}（应通过 service.get 或 typed client）`);
      }
    }
  }
}

/* ──────────────────────────────────────────────────────────────────
 * 入口
 * ──────────────────────────────────────────────────────────────── */
async function main() {
  console.log(`[verify-module-publish] cwd: ${CWD}`);
  /* 包一层：单个 check 抛错不影响其它（之前是直接 await 串行，整体崩） */
  const wrap = (name, fn) => fn().catch((e) => record("fail", name, `抛错: ${e?.message ?? String(e)}`));
  const manifest = await wrap("manifest 读取", () => checkManifest());
  if (manifest) {
    await wrap("packageNameAlignment", () => checkPackageNameAlignment(manifest));
    await wrap("filesField", checkFilesField);
    await wrap("entryRegistration", checkEntryRegistration);
    await wrap("sdkPin", checkSdkPin);
  }
  await wrap("tarballContents", checkTarballContents);
  await wrap("crossModuleImports", checkCrossModuleImports);

  /* 输出 */
  for (const c of checks) {
    const icon = c.kind === "pass" ? "✓" : c.kind === "warn" ? "!" : "✗";
    const color = c.kind === "pass" ? "\x1b[32m" : c.kind === "warn" ? "\x1b[33m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`  ${color}${icon}${reset} ${c.name}  ${c.kind === "pass" ? "" : c.msg}`);
  }

  console.log("");
  console.log(`[verify-module-publish] ${pass} pass · ${warn} warn · ${fail} fail`);
  if (fail > 0) {
    console.error(`[verify-module-publish] FAILED（${fail} 项硬错）。修完再跑 sfmc mod publish。`);
    process.exit(1);
  } else {
    console.log(`[verify-module-publish] OK（${warn} 项警告；不阻塞 publish）。`);
    process.exit(0);
  }
}

main().catch((e) => die(e?.message ?? String(e)));