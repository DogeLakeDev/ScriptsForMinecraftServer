// @ts-check
/**
 * 更新检查与安装共用的外网源。
 * 使用场景：平台版本检查、模块 dist-tag 检查、官方模块索引拉取，以及平台升级和模块安装时的 pnpm add。
 * 检查和安装读同一份 npm 源配置，避免检查走官方源、安装走镜像，两边看到的版本不一致。
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

/** npm 官方源。没有配置镜像时使用；配置了镜像时作为后备。 */
export const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";

/** 官方模块索引所在仓库与分支。fetch-module、CLI 搜索和模块更新都读这一份。 */
export const DEFAULT_REGISTRY_REPO = "Tanya7z/sfmc-modules";
export const DEFAULT_REGISTRY_TAG = "main";

/**
 * 官方模块索引的候选地址：GitHub 原始文件，以及 jsDelivr 对同一文件的加速地址。
 * 使用场景：fetchFirstJson 同时请求，取先成功的一份；GitHub 不通时由 jsDelivr 提供。
 * jsDelivr 对分支内容有缓存，索引更新后可能晚一些才能从它读到。
 */
export const MODULE_INDEX_URLS = [
  `https://raw.githubusercontent.com/${DEFAULT_REGISTRY_REPO}/${DEFAULT_REGISTRY_TAG}/index.json`,
  `https://cdn.jsdelivr.net/gh/${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}/index.json`,
];

/**
 * 规范化 npm 源地址：只接受 http(s)，末尾补斜杠。不合法时返回 null。
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeRegistry(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    return null;
  }
}

/**
 * 读取配置的 npm 源。
 * 优先级：环境变量 SFMC_NPM_REGISTRY → configs/runtime.json#npm_registry → npm 官方源。
 * 使用场景：npmRegistries 计算请求顺序；配置值不合法时按未配置处理。
 * @param {string} [root]
 * @returns {string}
 */
export function configuredNpmRegistry(root = ROOT) {
  const fromEnv = normalizeRegistry(process.env.SFMC_NPM_REGISTRY);
  if (fromEnv) return fromEnv;
  try {
    const text = fs.readFileSync(path.join(root, "configs", "runtime.json"), "utf8").replace(/^\uFEFF/, "");
    const fromConfig = normalizeRegistry(JSON.parse(text)?.npm_registry);
    if (fromConfig) return fromConfig;
  } catch {
    /* 没有 runtime.json 或内容不是 JSON 时用官方源 */
  }
  return OFFICIAL_NPM_REGISTRY;
}

/**
 * 依次使用的 npm 源：配置的源在前，官方源兜底（去重）。
 * 使用场景：版本检查同时请求这些源；pnpm 安装按这个顺序逐个尝试。
 * @param {string} [root]
 * @returns {string[]}
 */
export function npmRegistries(root = ROOT) {
  return [...new Set([configuredNpmRegistry(root), OFFICIAL_NPM_REGISTRY])];
}

/**
 * 包元数据在各 npm 源上的地址，顺序与 npmRegistries 相同。
 * @param {string} pathname 例如 `@sfmc-bds%2fsfmc/latest`，不带开头斜杠
 * @param {string} [root]
 * @returns {string[]}
 */
export function npmMetadataUrls(pathname, root = ROOT) {
  return npmRegistries(root).map((registry) => `${registry}${pathname}`);
}

/**
 * 同时请求多个地址，返回最先成功且能解析的 JSON，并中止其余请求；全部失败时汇总各源错误。
 * 使用场景：模块索引（GitHub / jsDelivr）和 npm 元数据（镜像 / 官方）。某个源超时时不再拖慢整体检查。
 * @param {string[]} urls
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [options]
 * @returns {Promise<{ url: string, json: any }>}
 */
export async function fetchFirstJson(urls, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const controllers = urls.map(() => new AbortController());
  const attempts = urls.map(async (url, index) => {
    const signal = AbortSignal.any([controllers[index].signal, AbortSignal.timeout(timeoutMs)]);
    const res = await fetch(url, { headers: options.headers ?? {}, signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return { url, json: await res.json(), index };
  });
  try {
    const winner = await Promise.any(attempts);
    controllers.forEach((controller, index) => {
      if (index !== winner.index) controller.abort();
    });
    return { url: winner.url, json: winner.json };
  } catch (error) {
    const reasons = error instanceof AggregateError ? error.errors : [error];
    throw new Error(
      `所有源均不可用: ${reasons.map((reason, index) => `${urls[index]}: ${reason instanceof Error ? reason.message : String(reason)}`).join("; ")}`,
    );
  }
}

/**
 * 按 npmRegistries 的顺序执行 pnpm 安装：配置的源失败时改用官方源再试一次。
 * 使用场景：平台升级和模块安装的 pnpm add。镜像同步有延迟，刚发布的依赖可能暂时 404。
 * 只有一个源时原样抛出它的错误；多个源都失败时合并各源的错误信息。
 * @template T
 * @param {(registry: string) => Promise<T>} run
 * @param {string} [root]
 * @returns {Promise<T>}
 */
export async function withNpmRegistry(run, root = ROOT) {
  const registries = npmRegistries(root);
  /** @type {string[]} */
  const failures = [];
  for (const registry of registries) {
    try {
      return await run(registry);
    } catch (error) {
      if (registries.length === 1) throw error;
      failures.push(`${registry}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(failures.join("\n"));
}
