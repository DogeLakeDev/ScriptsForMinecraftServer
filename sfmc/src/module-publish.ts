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
  /* 薄 index PR */
  ghRepo: string;            /* OWNER/REPO；默认 Tanya7z/sfmc-modules */
  ghPush: boolean;           /* 显式 opt-in：真去 fork + branch + PR；否则只打印意图 */
  ghForkRemote: string;      /* fork 的 remote 名，默认 sfmc-modules-fork */
}

export const DEFAULT_GH_REPO = "Tanya7z/sfmc-modules";

export function parsePublishFlags(args: string[]): PublishFlags {
  const flags: PublishFlags = {
    dryRun: false,
    bump: null,
    customVersion: null,
    scope: null,
    skipIndexPr: false,
    tag: "latest",
    access: "public",
    ghRepo: DEFAULT_GH_REPO,
    ghPush: false,
    ghForkRemote: "sfmc-modules-fork",
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
    else if (a === "--gh-repo") flags.ghRepo = args[++i] ?? DEFAULT_GH_REPO;
    else if (a?.startsWith("--gh-repo=")) flags.ghRepo = a.slice("--gh-repo=".length);
    else if (a === "--gh-push") flags.ghPush = true;
    else if (a === "--gh-fork-remote") flags.ghForkRemote = args[++i] ?? "sfmc-modules-fork";
    else if (a?.startsWith("--gh-fork-remote=")) flags.ghForkRemote = a.slice("--gh-fork-remote=".length);
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
 * gh CLI 适配：spawn + auth + fork → branch → patch index.json → PR
 *
 * 安全：默认不真执行（除非 --gh-push）；缺鉴权降级为打印意图。
 * 不重新发明 git protocol —— 委托 `gh repo fork/clone/api`。
 * ──────────────────────────────────────────────────────────── */
type GhResult = { code: number | null; stdout: string; stderr: string };

function runGh(args: string[], opts: { cwd?: string; stdin?: string } = {}): Promise<GhResult> {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "gh.exe" : "gh";
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
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
    if (opts.stdin) proc.stdin.write(opts.stdin);
    proc.stdin?.end();
    proc.on("exit", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", (e) => resolve({ code: -1, stdout, stderr: `${stderr}${e.message}` }));
  });
}

async function ghAuthStatus(): Promise<{ ok: boolean; user: string; error: string }> {
  const r = await runGh(["auth", "status"]);
  if (r.code !== 0) return { ok: false, user: "", error: r.stderr.trim() || "gh auth 失败" };
  /* `gh auth status` 输出示例：`Logged in to github.com as <user> (keyring)` */
  const m = /(?:as|account)\s+([\w-]+)/i.exec(r.stdout + r.stderr);
  return { ok: true, user: m?.[1] ?? "", error: "" };
}

/** 把 `OWNER/REPO` 拆成 [owner, repo]。 */
export function splitOwnerRepo(s: string): [string, string] | null {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(s.trim());
  return m ? [m[1]!, m[2]!] : null;
}

/** 计算 index.json 新条目（语义单一：仅为新版本加一条；已有则跳过）。 */
export function indexEntryFor(pkgName: string, version: string, sdkRange: string = ">=0.2.0"): {
  id: string;
  npm: string;
  version: string;
  sdk: string;
  timestamp: number;
} {
  const npmPkg = pkgName.startsWith("@") ? pkgName : `@${pkgName}`;
  /* id = 去掉 scope 与 module-/sfmc-module- 前缀：
   *   "@sfmc-bds/module-land"   → "land"
   *   "@alice/sfmc-module-foo"  → "foo"
   *   "@scope/bar"              → "bar"
   *   "@module-x"               → "@module-x"（非 scoped 包，保留 npm 名当 id 兜底）
   */
  let id: string;
  if (npmPkg.includes("/")) {
    id = npmPkg.split("/").pop()!.replace(/^module-/, "").replace(/^sfmc-module-/, "");
  } else {
    id = npmPkg.replace(/^module-/, "").replace(/^sfmc-module-/, "");
  }
  return { id, npm: npmPkg, version, sdk: sdkRange, timestamp: Date.now() };
}

/* ─────────────────────────────────────────────────────────────
 * 薄 index PR 主入口
 * ──────────────────────────────────────────────────────────── */
export async function openIndexPr(
  pkgName: string,
  version: string,
  opts: {
    dryRun: boolean;
    skipIndexPr: boolean;
    ghPush: boolean;
    ghRepo: string;
    ghForkRemote: string;
  }
): Promise<{ ok: boolean; skipped: boolean; intent: string[]; message: string; prUrl?: string }> {
  if (opts.skipIndexPr) {
    return { ok: true, skipped: true, intent: [], message: "已跳过薄 index PR（--skip-index-pr）" };
  }

  const target = splitOwnerRepo(opts.ghRepo);
  if (!target) return { ok: false, skipped: false, intent: [], message: `[publish] --gh-repo 非法: ${opts.ghRepo}（需 OWNER/REPO）` };
  const [owner, repo] = target;
  const entry = indexEntryFor(pkgName, version);
  const branchName = `publish/${entry.id}-${version}`;
  const title = `chore(index): ${entry.id}@${version}`;
  const body = [
    `Automated PR from \`sfmc mod publish\`.`,
    ``,
    `- npm: \`${entry.npm}\``,
    `- version: \`${entry.version}\``,
    `- sdk: \`${entry.sdk}\``,
  ].join("\n");

  const intent = [
    `gh repo fork ${owner}/${repo} --remote-name=${opts.ghForkRemote} --clone=false`,
    `gh repo clone ${opts.ghForkRemote}/${repo} fork-workdir -- --depth=1`,
    `cd fork-workdir`,
    `git checkout -b ${branchName}`,
    `edit index.json (upsert ${entry.id}: { npm=${entry.npm}, version=${entry.version}, sdk="${entry.sdk}" })`,
    `git add index.json && git commit -m "${title}"`,
    `git push -u ${opts.ghForkRemote} ${branchName}`,
    `gh pr create --repo ${owner}/${repo} --head ${opts.ghForkRemote}:${branchName} --title "${title}" --body "${body}"`,
  ];

  if (!opts.ghPush) {
    return {
      ok: true,
      skipped: false,
      intent,
      message: `[publish] dry-run：将向 ${owner}/${repo} 开 PR 登记 ${entry.id}@${version}（加 --gh-push 真执行）`,
    };
  }

  /* 真执行路径：鉴权检查 + 逐步跑上面的 intent */
  const auth = await ghAuthStatus();
  if (!auth.ok) {
    return {
      ok: false,
      skipped: false,
      intent,
      message: `[publish] gh 未登录：${auth.error}\n  → \`gh auth login\` 后重试，或省略 --gh-push 仅 dry-run`,
    };
  }

  /* 1) fork */
  const forkRes = await runGh(["repo", "fork", `${owner}/${repo}`, `--remote-name=${opts.ghForkRemote}`, "--clone=false"]);
  if (forkRes.code !== 0 && !/already exists/i.test(forkRes.stderr)) {
    return { ok: false, skipped: false, intent, message: `[publish] gh fork 失败：${forkRes.stderr.trim()}` };
  }
  /* 2) clone fork 到临时目录 */
  const os = await import("node:os");
  const fsSync = await import("node:fs");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-index-"));
  const clone = await runGh(["repo", "clone", `${auth.user}/${repo}`, tmp, "--", "--depth=1"]);
  if (clone.code !== 0) return { ok: false, skipped: false, intent, message: `[publish] gh clone 失败：${clone.stderr.trim()}` };

  /* 3) branch + patch index.json */
  const br = await runGh(["repo", "sync"], { cwd: tmp });
  void br; /* 软同步，失败不致命 */
  const branchRes = await spawnBranch(tmp, branchName);
  if (branchRes.code !== 0) {
    fsSync.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, skipped: false, intent, message: `[publish] branch 创建失败：${branchRes.stderr.trim()}` };
  }
  const indexPath = path.join(tmp, "index.json");
  const patchRes = await patchIndexFile(indexPath, entry);
  if (!patchRes.ok) {
    fsSync.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, skipped: false, intent, message: `[publish] patch index.json 失败：${patchRes.error}` };
  }

  /* 4) commit + push */
  const commitRes = await runGh(["api", "-X", "POST", "--input", "-"], {
    cwd: tmp,
    /* 委托 git 直 commit，避免 gh api 没有该 endpoint */
  }).catch(() => ({ code: 0, stdout: "", stderr: "" }));
  void commitRes;
  /* 实际 commit 走 git 透传（更稳） */
  const gitCommit = await spawnGit(tmp, ["add", "index.json"]);
  if (gitCommit.code !== 0) {
    fsSync.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, skipped: false, intent, message: `[publish] git add 失败：${gitCommit.stderr.trim()}` };
  }
  const gitCommitMsg = await spawnGit(tmp, ["commit", "-m", title]);
  if (gitCommitMsg.code !== 0) {
    fsSync.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, skipped: false, intent, message: `[publish] git commit 失败：${gitCommitMsg.stderr.trim()}` };
  }
  const gitPush = await spawnGit(tmp, ["push", opts.ghForkRemote, branchName]);
  if (gitPush.code !== 0) {
    fsSync.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, skipped: false, intent, message: `[publish] git push 失败：${gitPush.stderr.trim()}` };
  }

  /* 5) gh pr create */
  const pr = await runGh([
    "pr", "create",
    "--repo", `${owner}/${repo}`,
    "--head", `${auth.user}:${branchName}`,
    "--title", title,
    "--body", body,
  ], { cwd: tmp });
  fsSync.rmSync(tmp, { recursive: true, force: true });
  if (pr.code !== 0) {
    return { ok: false, skipped: false, intent, message: `[publish] gh pr create 失败：${pr.stderr.trim()}` };
  }
  const prUrl = pr.stdout.trim().split(/\r?\n/).pop() ?? "";
  return { ok: true, skipped: false, intent, message: `[publish] 薄 index PR 已开：${prUrl || "（请到 GitHub 查看）"}`, prUrl };
}

/* ─────────────────────────────────────────────────────────────
 * 低层 helper：git/spawn 与 index.json 补丁
 * ──────────────────────────────────────────────────────────── */
function spawnGit(cwd: string, args: string[]): Promise<GhResult> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
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

async function spawnBranch(cwd: string, branch: string): Promise<GhResult> {
  /* `git checkout -b` 比 gh api 稳；用 spawn 直调 */
  return spawnGit(cwd, ["checkout", "-b", branch]);
}

/** 在现有 index.json 上 upsert 一条；缺文件则建空数组。 */
export async function patchIndexFile(
  indexPath: string,
  entry: ReturnType<typeof indexEntryFor>
): Promise<{ ok: boolean; error?: string }> {
  let list: Array<Record<string, unknown>> = [];
  try {
    const text = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.modules)) list = parsed.modules;
    else if (Array.isArray(parsed)) list = parsed;
  } catch {
    /* 文件不存在或非法 → 当空数组 */
  }
  /* 幂等 upsert：id 已有则跳过 */
  if (list.some((m) => m && typeof m === "object" && (m as { id?: string }).id === entry.id)) {
    return { ok: false, error: `${entry.id} 已在 index.json 中存在；请手动检查后再 publish` };
  }
  list.push({
    id: entry.id,
    npm: entry.npm,
    version: entry.version,
    sdk: entry.sdk,
    timestamp: entry.timestamp,
  });
  list.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)));
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify({ version: 1, modules: list }, null, 2)}\n`, "utf8");
  return { ok: true };
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
  const pr = await openIndexPr(pkgName, nextVer, {
    dryRun: flags.dryRun,
    skipIndexPr: flags.skipIndexPr,
    ghPush: flags.ghPush,
    ghRepo: flags.ghRepo,
    ghForkRemote: flags.ghForkRemote,
  });
  out.push(pr.message);
  if (!pr.ok && !pr.skipped) {
    /* PR 失败不回滚 publish（npm 已经成功） */
    out.push(c.yellow(`[publish] 注意：薄 index PR 失败，但 npm 包已发布；可手动补 index.json。`));
  }

  out.push(c.green(t("publish.done")));
  return out.join("\n") + "\n";
}