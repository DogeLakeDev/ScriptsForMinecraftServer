/** 模块索引提交核心。仅写入专用分支中的单个分片，不操作作者工作树。 */
import { Ajv, type AnySchema } from "ajv";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import semver from "semver";

export const MODULE_REGISTRY_REPO = "DogeLakeDev/sfmc-modules";
type Json = Record<string, unknown>;
export interface RegistryMetadata {
  name?: string;
  description?: string;
  category?: "gameplay" | "utility" | "system" | "economy" | "social";
  tags?: string[];
  authors?: string[];
}
export interface RegistryModule extends RegistryMetadata {
  id: string;
  name: string;
  description: string;
  npm: string;
  version: string;
  sdk: string;
  license: string;
  official: boolean;
  repo?: string;
  requires: string[];
}
export interface RegistrySubmitOptions {
  moduleRoot?: string;
  /** 表单等入口提供原始字段，仍须经过相同 npm、Schema 和索引校验。 */
  entry?: RegistryModule;
  registryRepo?: string;
  dryRun?: boolean;
  /** 维护者 / GitHub App 在索引仓建分支，须有 Contents 和 Pull requests 写权限。 */
  noFork?: boolean;
  token?: string;
  /** 等待刚发布的精确版本可见；仅重试 404，最长 60 秒。 */
  waitForPublish?: boolean;
  log?: (message: string) => void;
}
export interface RegistrySubmitResult {
  status: "preview" | "unchanged" | "created" | "updated";
  entry: RegistryModule;
  previous: RegistryModule | null;
  path: string;
  prUrl?: string;
  registryRepo: string;
}
function object(value: unknown, label: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 须为 JSON 对象`);
  return value as Json;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`缺少 ${label}`);
  return value.trim();
}
function sourceRepo(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const raw = typeof value === "string" ? value : object(value, "repository").url;
  const repo = text(raw, "repository.url")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
  const url = new URL(repo);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("repository 须为不含凭据的 HTTPS 地址");
  return url.href.replace(/\/$/, "");
}

/** 作者配置只补充展示字段；包、版本、SDK 和依赖来自已有契约。 */
export function createRegistryEntry(
  pkgValue: unknown,
  manifestValue: unknown,
  metadataValue: unknown = {}
): RegistryModule {
  const pkg = object(pkgValue, "package.json");
  const manifest = object(manifestValue, "sapi/manifest.json");
  const metadata = object(metadataValue, "sfmc.registry.json");
  const allowed = new Set(["$schema", "name", "description", "category", "tags", "authors"]);
  for (const key of Object.keys(metadata))
    if (!allowed.has(key)) throw new Error(`sfmc.registry.json 不支持字段 ${key}`);
  if (pkg.private === true) throw new Error("private 模块不能提交公共索引");
  if (manifest.schemaVersion !== 2) throw new Error("需要 schemaVersion=2 的模块清单");
  const peers = object(pkg.peerDependencies ?? {}, "peerDependencies");
  const description = metadata.description ?? pkg.description ?? "";
  if (typeof description !== "string") throw new Error("功能介绍（description）须为字符串，可留空");
  const entry: RegistryModule = {
    id: text(manifest.id, "manifest.id"),
    name: text(metadata.name ?? manifest.name, "展示名称（name）"),
    description: description.trim(),
    npm: text(pkg.name, "package.name"),
    version: text(pkg.version, "package.version"),
    sdk: text(peers["@sfmc-bds/sdk"], "peerDependencies.@sfmc-bds/sdk"),
    license: text(pkg.license, "package.license"),
    official: false,
    requires: (manifest.requires ?? []) as string[],
  };
  const repo = sourceRepo(pkg.repository);
  if (repo) entry.repo = repo;
  for (const key of ["category", "tags", "authors"] as const) {
    if (metadata[key] !== undefined) Object.assign(entry, { [key]: metadata[key] });
  }
  return entry;
}

async function readLocalEntry(root: string): Promise<{ entry: RegistryModule; overrides: Set<string> }> {
  const realRoot = await fs.realpath(root);
  const read = async (file: string) => {
    const target = await fs.realpath(path.join(realRoot, file));
    const relative = path.relative(realRoot, target);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error(`${file} 须位于模块目录内`);
    const raw = await fs.readFile(target, "utf8");
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`${file} 包含无效 JSON`);
    }
  };
  let metadata: unknown = {};
  try {
    metadata = await read("sfmc.registry.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    entry: createRegistryEntry(await read("package.json"), await read("sapi/manifest.json"), metadata),
    overrides: new Set(Object.keys(object(metadata, "sfmc.registry.json"))),
  };
}

class GitHubError extends Error {
  constructor(
    public status: number,
    endpoint: string,
    rateLimited = false
  ) {
    super(
      `GitHub ${status}: ${endpoint}${rateLimited ? "（API 配额已用尽，请登录后重试或等待配额恢复）" : status === 401 || status === 403 ? "（检查登录及 Contents / Pull requests 权限）" : ""}`
    );
  }
}
async function resolveToken(required: boolean): Promise<string | undefined> {
  const configured = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (configured) return configured;
  try {
    const { stdout } = await promisify(execFile)("gh", ["auth", "token", "--hostname", "github.com"], {
      timeout: 10000,
      windowsHide: true,
    });
    return stdout.trim() || undefined;
  } catch {
    if (required) throw new Error("提交需要 GitHub 登录：执行 gh auth login，或设置 GH_TOKEN。");
    return undefined;
  }
}
function github(token?: string) {
  return async function api<T>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com/${endpoint}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "sfmc-devkit",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    // 不回显服务器正文或认证信息。
    if (!response.ok)
      throw new GitHubError(
        response.status,
        endpoint,
        response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0"
      );
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  };
}
type Api = ReturnType<typeof github>;
interface GitHubRepository {
  id: number;
  full_name: string;
  default_branch: string;
  fork: boolean;
  permissions?: { push?: boolean };
  parent?: { id: number; full_name: string };
  source?: { id: number; full_name: string };
}
interface Content {
  type: string;
  encoding: string;
  content: string;
  sha: string;
}
function decode(file: Content): unknown {
  if (file.type !== "file" || file.encoding !== "base64") throw new Error("索引内容须为普通 JSON 文件");
  return JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
}
async function content(api: Api, repo: string, file: string, ref: string): Promise<Content | null> {
  try {
    return await api<Content>(`repos/${repo}/contents/${file}?ref=${encodeURIComponent(ref)}`);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}
function same(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, stable(item)])
          )
        : value;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
async function checkPublished(entry: RegistryModule, wait: boolean): Promise<void> {
  const deadline = Date.now() + (wait ? 60000 : 0);
  while (true) {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(entry.npm)}/${encodeURIComponent(entry.version)}`,
      {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      }
    );
    if (response.status === 404 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `公共 npm 尚无可用的 ${entry.npm}@${entry.version}（HTTP ${response.status}）；先发布该精确版本。`
      );
    const pkg = object(await response.json(), "npm 元数据");
    const peers = object(pkg.peerDependencies ?? {}, "npm peerDependencies");
    if (
      pkg.name !== entry.npm ||
      pkg.version !== entry.version ||
      pkg.license !== entry.license ||
      peers["@sfmc-bds/sdk"] !== entry.sdk
    ) {
      throw new Error("已发布包的名称、版本、许可证或 SDK 兼容范围与提交信息不一致");
    }
    if (sourceRepo(pkg.repository) !== entry.repo) throw new Error("已发布包的源码地址与提交信息不一致");
    return;
  }
}

/** 所有入口共用：预览也验证已发布版本与最新分片；预览阶段不产生远端写入。 */
export async function submitModuleToRegistry(options: RegistrySubmitOptions = {}): Promise<RegistrySubmitResult> {
  const repo = options.registryRepo ?? MODULE_REGISTRY_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("registryRepo 须为 owner/repo");
  const local = options.entry ? null : await readLocalEntry(path.resolve(options.moduleRoot ?? process.cwd()));
  const entry = options.entry ? structuredClone(options.entry) : local!.entry;
  entry.requires ??= [];
  const token = options.token ?? (await resolveToken(!options.dryRun));
  if (!options.dryRun && !token) throw new Error("提交需要有效的 GitHub 登录或 GH_TOKEN");
  const api = github(token);
  const upstream = await api<GitHubRepository>(`repos/${repo}`);
  const canonicalRepo = upstream.full_name;
  const base = upstream.default_branch;
  const baseRef = await api<{ object: { sha: string } }>(
    `repos/${canonicalRepo}/git/ref/heads/${encodeURIComponent(base)}`
  );
  const baseSha = baseRef.object.sha;
  const schemaFile = await content(api, canonicalRepo, "schemas/registry-module.schema.json", baseSha);
  if (!schemaFile) throw new Error("索引仓缺少 registry-module.schema.json");
  const ajv = new Ajv({ allErrors: true, strict: true });
  ajv.addFormat("semver-range", (value: string) => !!value.trim() && semver.validRange(value) !== null);
  const validate = ajv.compile(decode(schemaFile) as AnySchema);
  entry.official = false; // 首次收录永不自行声明官方身份。
  if (!validate(entry)) throw new Error(`索引元数据不合规：${ajv.errorsText(validate.errors)}`);
  if (!semver.valid(entry.version)) throw new Error("版本须为有效的精确 SemVer");
  const file = `modules/${entry.id}.json`;
  options.log?.(`校验 ${entry.npm}@${entry.version} 与最新索引分片`);
  const tree = await api<{ truncated: boolean; tree: Array<{ path: string; type: string; sha: string }> }>(
    `repos/${canonicalRepo}/git/trees/${baseSha}?recursive=1`
  );
  if (tree.truncated) throw new Error("索引树过大，无法完整检查依赖");
  const shards = tree.tree.filter((item) => /^modules\/[^/]+\.json$/.test(item.path) && item.type === "blob");
  const modules: Record<string, RegistryModule> = Object.create(null) as Record<string, RegistryModule>;
  // 只读取该模块和依赖闭包，避免每次提交扫描整个索引并耗尽 API 配额。
  const shardByPath = new Map(shards.map((item) => [item.path, item]));
  async function load(id: string): Promise<RegistryModule | null> {
    const shard = shardByPath.get(`modules/${id}.json`);
    if (!shard) return null;
    const blob = await api<{ encoding: string; content: string }>(`repos/${canonicalRepo}/git/blobs/${shard.sha}`);
    if (blob.encoding !== "base64") throw new Error("无效索引 blob 编码");
    const module = object(
      JSON.parse(Buffer.from(blob.content, "base64").toString("utf8")),
      shard.path
    ) as unknown as RegistryModule;
    if (module.id !== id) throw new Error(`索引分片 ID 不一致：${shard.path}`);
    return module;
  }
  const previous = await load(entry.id);
  if (previous) {
    if (previous.npm !== entry.npm || (previous.repo && sourceRepo(previous.repo) !== entry.repo))
      throw new Error("该 ID 已属于其他 npm 包或源码仓；请由维护者处理迁移");
    if (!semver.valid(previous.version) || semver.lt(entry.version, previous.version))
      throw new Error("不能降低已收录版本");
    entry.official = previous.official; // 仅继承索引仓已审核身份。
    // 单纯更新版本保留已整理的展示信息；作者配置可显式覆盖。
    if (local) {
      if (!local.overrides.has("name")) entry.name = previous.name;
      if (!local.overrides.has("description")) entry.description = previous.description;
    }
    for (const key of ["category", "tags", "authors"] as const) {
      if (entry[key] === undefined && previous[key] !== undefined)
        Object.assign(entry, { [key]: structuredClone(previous[key]) });
    }
  }
  if (!validate(entry)) throw new Error(`索引身份或字段不合规：${ajv.errorsText(validate.errors)}`);
  modules[entry.id] = entry;
  const queue = [...entry.requires];
  const loaded = new Set([entry.id]);
  while (queue.length) {
    const batch = queue.splice(0, 4).filter((id) => {
      if (loaded.has(id)) return false;
      loaded.add(id);
      return true;
    });
    await Promise.all(
      batch.map(async (id) => {
        const dependency = await load(id);
        if (!dependency) throw new Error(`依赖 ${id} 尚未收录，请先提交依赖模块`);
        if (!validate(dependency)) throw new Error(`依赖 ${id} 的索引元数据不合规`);
        modules[id] = dependency;
        queue.push(...(dependency.requires ?? []));
      })
    );
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`模块依赖存在循环：${id}`);
    if (visited.has(id)) return;
    const module = modules[id];
    if (!module) throw new Error(`依赖 ${id} 尚未收录，请先提交依赖模块`);
    visiting.add(id);
    for (const dependency of module.requires ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  visit(entry.id);
  await checkPublished(entry, Boolean(options.waitForPublish));
  const result = { entry, previous, path: file, registryRepo: canonicalRepo };
  if (options.dryRun) return { ...result, status: "preview" };
  if (same(entry, previous)) return { ...result, status: "unchanged" };

  let headRepo = canonicalRepo;
  if (!options.noFork && upstream.permissions?.push !== true) {
    const user = await api<{ login: string }>("user");
    const forkName = `${user.login}/${canonicalRepo.split("/")[1]}`;
    let fork: GitHubRepository | undefined;
    try {
      fork = await api(`repos/${forkName}`);
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 404)) throw error;
    }
    if (!fork)
      fork = await api<GitHubRepository>(`repos/${canonicalRepo}/forks`, "POST", { default_branch_only: true });
    if (fork.id === upstream.id) {
      // 候选地址与目标地址可能因重定向指向同一仓库，按实际权限处理。
      if (fork.permissions?.push !== true)
        throw new Error(
          `${forkName} 已重定向到 ${canonicalRepo}，当前凭据没有写权限；请检查 GitHub 登录与 Contents 权限。`
        );
    } else {
      const networkId = upstream.source?.id ?? upstream.id;
      if (!fork.fork || (fork.parent?.id !== upstream.id && fork.source?.id !== networkId))
        throw new Error(
          `${fork.full_name} 未与目标索引仓关联，无法作为该 PR 的来源；请使用目标仓的 fork，或有写权限时使用 --no-fork。`
        );
      headRepo = fork.full_name;
    }
  }
  type Pull = { number: number; html_url: string; head: { ref: string; repo: { full_name: string } | null } };
  let pull: Pull | undefined;
  const prefix = `sfmc-submit/${entry.id}/`;
  for (let page = 1; ; page++) {
    const pagePulls = await api<Pull[]>(
      `repos/${canonicalRepo}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100&page=${page}`
    );
    const matches = pagePulls.filter(
      (item) => item.head.ref.startsWith(prefix) && item.head.repo?.full_name.toLowerCase() === headRepo.toLowerCase()
    );
    if (matches.length > 1 || (pull && matches.length)) throw new Error("该模块有多个提交 PR，请先合并或关闭多余 PR");
    pull ??= matches[0];
    if (pagePulls.length < 100) break;
  }
  // 已合并的分支无需重置；新一轮提交以最新 main 的 SHA 标识。
  const branch = pull?.head.ref ?? `${prefix}${baseSha.slice(0, 12)}`;
  const head = `${headRepo.split("/")[0]}:${branch}`;
  let branchRef: { object: { sha: string } } | null = null;
  // 新 fork 的创建是异步操作，最多等待 15 秒。
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      branchRef = await api(`repos/${headRepo}/git/ref/heads/${encodeURIComponent(branch)}`);
      break;
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 404)) throw error;
      try {
        branchRef = await api(`repos/${headRepo}/git/refs`, "POST", { ref: `refs/heads/${branch}`, sha: baseSha });
        break;
      } catch (createError) {
        if (!(createError instanceof GitHubError && [404, 422].includes(createError.status)) || attempt === 5)
          throw createError;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
  if (!branchRef) throw new Error("提交分支尚未就绪，请重试");
  const comparison = await api<{ files: Array<{ filename: string }> }>(
    `repos/${canonicalRepo}/compare/${baseSha}...${encodeURIComponent(`${headRepo.split("/")[0]}:${branchRef.object.sha}`)}`
  );
  if (comparison.files.some((item) => item.filename !== file))
    throw new Error("专用提交分支包含其他文件改动，请先由作者处理");
  const oldFile = await content(api, headRepo, file, branchRef.object.sha);
  const oldEntry = oldFile ? decode(oldFile) : null;
  if (oldEntry) {
    const pending = object(oldEntry, file);
    if (
      pending.npm !== entry.npm ||
      (pending.repo && sourceRepo(pending.repo) !== entry.repo) ||
      typeof pending.version !== "string" ||
      !semver.valid(pending.version) ||
      semver.lt(entry.version, pending.version)
    ) {
      throw new Error("已有提交的来源或版本冲突；拒绝覆盖");
    }
  }
  if (!same(entry, oldEntry)) {
    await api(`repos/${headRepo}/contents/${file}`, "PUT", {
      message: `chore(registry): ${entry.id} ${entry.version}`,
      content: Buffer.from(`${JSON.stringify(entry, null, 2)}\n`).toString("base64"),
      branch,
      ...(oldFile ? { sha: oldFile.sha } : {}),
    });
  }
  const title = `收录 ${entry.id}@${entry.version}`;
  const body = `更新 \`${file}\`。\n\n- npm：\`${entry.npm}@${entry.version}\`（公共源精确版本已核对）\n- 源码：${entry.repo ?? "未提供"}\n- 许可证：\`${entry.license}\`\n- SDK：\`${entry.sdk}\`\n- 依赖：${entry.requires.join(", ") || "无"}\n\n已检查当前索引 Schema、ID 来源、版本与依赖关系。官方身份沿用维护者审核结果；请检查 PR 门禁后合并。`;
  if (pull) {
    if (same(entry, oldEntry)) return { ...result, status: "unchanged", prUrl: pull.html_url };
    await api(`repos/${canonicalRepo}/pulls/${pull.number}`, "PATCH", { title, body });
    return { ...result, status: "updated", prUrl: pull.html_url };
  }
  const created = await api<{ html_url: string }>(`repos/${canonicalRepo}/pulls`, "POST", { title, body, base, head });
  return { ...result, status: "created", prUrl: created.html_url };
}
