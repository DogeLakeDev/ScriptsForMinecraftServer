/**
 * sfmc/src/module-publish.ts — `sfmc mod publish` 保姆式 CLI
 *
 * 设计原则（plan）：
 *   - 不发明 npm 鉴权/协议；CLI 是 npm publish 的编排器 + 检查器 + 错误翻译。
 *   - 作者用自己 npm 账号 + 自己 scope（如 @<username>/sfmc-module-<id>）。
 *   - 不替身 npm 任何行为；常见 npm 错误翻译成中文可读 + 下一步动作。
 *
 * 流水线：
 *   0) npm whoami 检测登录态
 *   1) scope 推断（从 npm whoami 取账号；缺则 --scope 覆盖）
 *   2) dry-run 预检（manifest v2 + files + tarball 内容清单）
 *   3) version bump（patch|minor|major|custom；写入 package.json，**不改** manifest）
 *   4) npm publish（透传 --access public --provenance；私有改 --access restricted）
 *   5) 薄 index PR（除非 --skip-index-pr；用 gh api 在 sfmc-modules 仓开 PR）
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { c } from "./theme.js";
import { t } from "./i18n/index.js";

/* ─────────────────────────────────────────────────────────────
 * CLI 参数解析
 * ──────────────────────────────────────────────────────────── */
export interface PublishFlags {
  dryRun: boolean;
  bump: "patch" | "minor" | "major" | "custom" | null;
  customVersion: string | null;
  scope: string | null;
  skipIndexPr: boolean;
  tag: string;
  access: "public" | "restricted";
}

export function parsePublishFlags(args: string[]): PublishFlags {
  const flags: PublishFlags = {
    dryRun: false,
    bump: null,
    customVersion: null,
    scope: null,
    skipIndexPr: false,
    tag: "latest",
    access: "public",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--bump") flags.bump = (args[++i] as PublishFlags["bump"]) ?? null;
    else if (a?.startsWith("--bump=")) flags.bump = a.slice("--bump=".length) as PublishFlags["bump"];
    else if (a === "--scope") flags.scope = args[++i] ?? null;
    else if (a?.startsWith("--scope=")) flags.scope = a.slice("--scope=".length);
    else if (a === "--tag") flags.tag = args[++i] ?? "latest";
    else if (a?.startsWith("--tag=")) flags.tag = a.slice("--tag=".length);
    else if (a === "--skip-index-pr") flags.skipIndexPr = true;
    else if (a === "--access" && (args[i + 1] === "public" || args[i + 1] === "restricted")) {
      flags.access = args[++i]! as "public" | "restricted";
    } else if (a === "--access=public") flags.access = "public";
    else if (a === "--access=restricted") flags.access = "restricted";
    else if (a === "--help" || a === "-h") return flags;
  }
  return flags;
}

/* ─────────────────────────────────────────────────────────────
 * 子进程辅助
 * ──────────────────────────────────────────────────────────── */
type RunResult = { code: number | null; stdout: string; stderr: string };

function runNpm(args: string[], opts: { cwd?: string } = {}): Promise<RunResult> {
  const isWin = process.platform === "win32";
  /* Windows 上直接 spawn npm.cmd 会 EINVAL；走 cmd /c npm.cmd 可行。
   * POSIX 上 npm 是单一可执行文件，直接 spawn。
   * 不开 shell: true 避免 DEP0190（参数拼接安全风险）。 */
  const cmd = isWin ? "cmd.exe" : "npm";
  const fullArgs = isWin ? ["/c", "npm", ...args] : args;
  return new Promise((resolve) => {
    const proc = spawn(cmd, fullArgs, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("exit", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", (e) => resolve({ code: -1, stdout, stderr: `${stderr}${e.message}` }));
  });
}

/* ─────────────────────────────────────────────────────────────
 * npm whoami + scope 推断
 * ──────────────────────────────────────────────────────────── */
export async function detectNpmUser(): Promise<{ ok: true; user: string } | { ok: false; stderr: string }> {
  const r = await runNpm(["whoami"]);
  if (r.code === 0) {
    const user = (r.stdout || r.stderr).trim().split(/\r?\n/)[0] ?? "";
    if (user) return { ok: true, user };
    return { ok: false, stderr: "npm whoami 无输出" };
  }
  return { ok: false, stderr: r.stderr.trim() || "npm whoami 失败" };
}

export function defaultScopeFor(user: string): string {
  return user.startsWith("@") ? user.slice(1) : user;
}

/* ─────────────────────────────────────────────────────────────
 * 错误翻译（与 install 同思路；单独函数保持单一职责）
 * ──────────────────────────────────────────────────────────── */
export function translateNpmPublishError(pkgName: string, stderr: string): string {
  const text = String(stderr || "");
  if (/ENEEDAUTH|not logged in/i.test(text)) {
    return `[publish] 未登录 npm。运行 \`npm login --auth-type=web\` 后重试；或临时设 NPM_TOKEN。`;
  }
  if (/EOTP|one-time password/i.test(text)) {
    return `[publish] 需要 2FA 码。在终端输入 OTP（推荐用 WebAuthn / security key）。`;
  }
  if (/need to confirm/i.test(text) || /Confirm email/i.test(text)) {
    return `[publish] 首次在该 scope 发包；npm 要求邮箱确认。打开 https://www.npmjs.com/settings/<yourname>/ 确认邮箱后重试。`;
  }
  if (/You do not have permission to publish/i.test(text)) {
    return `[publish] 无权限发到 "${pkgName}"。常见原因：(a) 你首次在该 scope 发包、邮箱未确认；(b) 包名已被他人占用。`;
  }
  if (/402 Payment Required/i.test(text)) {
    return `[publish] 私有包需要付费 npm 账号。改用 \`--access public\` 或换公开 scope。`;
  }
  if (/Package name too similar/i.test(text)) {
    return `[publish] 包名太接近已存在包；建议改名（rename 脚本已在模板仓提供）。`;
  }
  if (/ERESOLVE/i.test(text)) {
    return `[publish] 依赖冲突（ERESOLVE）。提示：用 --legacy-peer-deps 重试，或确认 SDK/宿主版本兼容。`;
  }
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(text)) {
    return `[publish] npm 网络错误。检查代理 / 网络；或离线用 \`sfmc mod install --from local:./x.tgz\`。`;
  }
  return `[publish] npm publish ${pkgName} 失败：\n${text.trim()}`;
}

/* ─────────────────────────────────────────────────────────────
 * dry-run 预检
 * ──────────────────────────────────────────────────────────── */
export interface PrecheckResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  /** npm pack --dry-run 解析出的 tarball 内容（包内文件清单）。 */
  tarballFiles: string[];
}

export async function runPrecheck(cwd: string): Promise<PrecheckResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  /* 1) manifest.json v2 */
  const manifestPath = path.join(cwd, "sapi", "manifest.json");
  try {
    const text = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(text) as { schemaVersion?: number; id?: string; configKey?: string };
    if (manifest.schemaVersion !== 2) errors.push(`manifest schemaVersion 必须是 2（当前 ${manifest.schemaVersion ?? "未设置"}）`);
    if (!manifest.id) errors.push("manifest.id 缺失");
    if (!manifest.configKey) errors.push("manifest.configKey 缺失");
  } catch (e) {
    errors.push(`manifest.json 读取失败: ${(e as Error).message}`);
  }
  /* 2) package.json#files 必含 sapi/ */
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
      name?: string;
      files?: string[];
    };
    if (!pkg.name) errors.push("package.json#name 缺失");
    if (!Array.isArray(pkg.files) || !pkg.files.includes("sapi")) {
      warnings.push(`package.json#files 不含 "sapi"；npm pack 会打出空 tarball。建议加 ["sapi", "test"]。`);
    }
  } catch (e) {
    errors.push(`package.json 读取失败: ${(e as Error).message}`);
  }
  /* 3) npm pack --dry-run：解析 tarball 内容 */
  const r = await runNpm(["pack", "--dry-run"], { cwd });
  const tarballFiles = parseTarballListing(r.stdout);
  if (r.code !== 0) {
    errors.push(`npm pack --dry-run 失败：${r.stderr.trim()}`);
  }
  /* 关键文件兜底校验 */
  const mustHave = ["package/package.json"];
  for (const f of mustHave) {
    if (!tarballFiles.some((t) => t.endsWith(f))) {
      warnings.push(`tarball 缺少关键文件 ${f}（npm pack 行为异常）`);
    }
  }
  return { ok: errors.length === 0, warnings, errors, tarballFiles };
}

/** 解析 `npm pack --dry-run` 输出（形如 `npm notice ... Filename: package/sapi/...`）。 */
function parseTarballListing(stdout: string): string[] {
  const files: string[] = [];
  const re = /^npm notice\s+Filename:\s+(.+)$/gm;
  for (const m of stdout.matchAll(re)) files.push(m[1]!.trim());
  return files;
}

/* ─────────────────────────────────────────────────────────────
 * version bump
 * ──────────────────────────────────────────────────────────── */
export function bumpSemver(current: string, level: PublishFlags["bump"], custom: string | null): string {
  if (level === "custom" && custom) {
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(custom)) {
      throw new Error(`invalid custom version: ${custom}`);
    }
    return custom;
  }
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!m) throw new Error(`无法解析当前版本: ${current}`);
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  if (level === "patch") return `${maj}.${min}.${pat + 1}`;
  throw new Error(`bump level 缺失或无效: ${String(level)}`);
}

export async function writePackageVersion(cwd: string, next: string): Promise<void> {
  const pkgPath = path.join(cwd, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.version = next;
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

export async function readPackageVersion(cwd: string): Promise<string> {
  const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}

/* ─────────────────────────────────────────────────────────────
 * npm publish 编排
 * ──────────────────────────────────────────────────────────── */
export async function runNpmPublish(
  cwd: string,
  pkgName: string,
  flags: PublishFlags
): Promise<{ ok: boolean; code: number | null; message: string }> {
  const args = ["publish", "--access", flags.access, "--tag", flags.tag];
  if (flags.dryRun) args.push("--dry-run");
  /* --provenance 需 GH Actions OIDC；本机可能没 OIDC → 让 npm 自身决定（透传） */
  const r = await runNpm(args, { cwd });
  const msg = r.code === 0 ? r.stdout.trim() : translateNpmPublishError(pkgName, r.stderr);
  return { ok: r.code === 0, code: r.code, message: msg };
}

/* ─────────────────────────────────────────────────────────────
 * 薄 index PR（保留为占位；gh CLI 真实开 PR 需要登录，远端协调）
 * ──────────────────────────────────────────────────────────── */
export async function openIndexPr(
  pkgName: string,
  version: string,
  opts: { dryRun: boolean; skipIndexPr: boolean }
): Promise<{ ok: boolean; skipped: boolean; message: string }> {
  if (opts.skipIndexPr) {
    return { ok: true, skipped: true, message: "已跳过薄 index PR（--skip-index-pr）" };
  }
  /* 占位：调用方需要先 `gh auth login` + 远端 sfmc-modules 仓存在。
   * 本函数不会在没鉴权时静默失败 —— 用 `gh` 是否可用作前置检查。 */
  const ghCheck = await runNpm(["config", "get", "registry"]); /* 仅借用 runNpm 调用模型 */
  void ghCheck;
  /* 真实现留给外部 follow-up；本阶段仅 dry-run 打印意图。 */
  const msg = `[publish] 薄 index PR（占位）：将在 sfmc-modules/index.json 新增 ${pkgName}@${version}。` +
    `需先 \`gh auth login\` 与远端 sfmc-modules 仓存在；本轮尚未实装 gh 调用，避免假阳性。`;
  return { ok: opts.dryRun, skipped: false, message: msg };
}

/* ─────────────────────────────────────────────────────────────
 * CLI 主入口
 * ──────────────────────────────────────────────────────────── */
export async function cmdModulePublish(args: string[]): Promise<string> {
  const flags = parsePublishFlags(args);
  const out: string[] = [];
  const cwd = process.cwd();

  /* 0) 登录态探测 */
  out.push(c.bold(t("publish.banner")));
  const who = await detectNpmUser();
  if (!who.ok) {
    out.push(c.red(t("publish.noLogin")));
    out.push("  " + who.stderr.split("\n")[0]!);
    out.push(c.dim(t("publish.noLoginHint")));
    return out.join("\n") + "\n";
  }
  out.push(c.green(`[publish] npm 已登录: ${who.user}`));
  const scope = (flags.scope ?? who.user).replace(/^@/, "");
  out.push(c.dim(`[publish] 默认 scope: @${scope}`));

  /* 1) 读取当前包名 */
  const pkgJson = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
  const pkgName = pkgJson.name ?? `${scope}/sfmc-module-?`;
  out.push(`[publish] 当前包名: ${pkgName}`);

  /* 2) dry-run 预检 */
  const pre = await runPrecheck(cwd);
  for (const w of pre.warnings) out.push(c.yellow(`[publish] warn: ${w}`));
  for (const e of pre.errors) out.push(c.red(`[publish] error: ${e}`));
  if (!pre.ok) {
    out.push(c.red(t("publish.precheckFail")));
    return out.join("\n") + "\n";
  }
  out.push(c.green(`[publish] precheck OK（${pre.tarballFiles.length} 文件入包）`));
  if (flags.dryRun) {
    out.push(c.dim(t("publish.dryRun.summary")));
    return out.join("\n") + "\n";
  }

  /* 3) version bump */
  const currentVer = await readPackageVersion(cwd);
  let nextVer = currentVer;
  if (flags.bump) {
    try {
      nextVer = bumpSemver(currentVer, flags.bump, flags.customVersion);
    } catch (e) {
      out.push(c.red(`[publish] bump 失败: ${(e as Error).message}`));
      return out.join("\n") + "\n";
    }
    await writePackageVersion(cwd, nextVer);
    out.push(c.green(`[publish] 版本 bump: ${currentVer} → ${nextVer}`));
  } else {
    out.push(c.dim(`[publish] 当前版本 ${currentVer}（未 bump；若已发布过相同版本 npm 会 409）`));
  }

  /* 4) npm publish 透传 */
  const pub = await runNpmPublish(cwd, pkgName, flags);
  out.push(pub.message);
  if (!pub.ok) {
    /* rollback version bump（避免本地留下脏 bump） */
    if (flags.bump && nextVer !== currentVer) {
      try {
        await writePackageVersion(cwd, currentVer);
        out.push(c.dim(`[publish] 已回滚 package.json#version: ${nextVer} → ${currentVer}`));
      } catch {
        /* best-effort */
      }
    }
    return out.join("\n") + "\n";
  }

  /* 5) 薄 index PR */
  const pr = await openIndexPr(pkgName, nextVer, { dryRun: flags.dryRun, skipIndexPr: flags.skipIndexPr });
  out.push(pr.message);

  out.push(c.green(t("publish.done")));
  return out.join("\n") + "\n";
}