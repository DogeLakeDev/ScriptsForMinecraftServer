/**
 * log-filter.ts — configs/log-filter.json 加载与匹配（纯判定 + 热读缓存）
 */
import { ensureSchemaConfig, readJson, stripConfigMeta } from "@sfmc-bds/sdk/node/config";
import type { LogLevel } from "@sfmc-bds/sdk/logs";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.js";
import { applyRuleReplacement, translateBdsLog } from "./log-translator.js";
import { getLocale } from "./i18n/index.js";

export type LogFilterMode = "drop" | "keep";
export type LogFilterApplyTo = "display" | "all";

export interface LogFilterRule {
  enabled?: boolean;
  sources?: string[];
  levels?: LogLevel[];
  contains?: string;
  /** JS RegExp 源；支持前缀 (?i) 表示忽略大小写 */
  regex?: string;
  /** 命中规则时的替换/翻译文本模板，支持 $1, $2 等正则捕获变量 */
  replace?: string;
}

export interface LogFilterConfig {
  enabled: boolean;
  mode: LogFilterMode;
  applyTo: LogFilterApplyTo;
  /** 是否开启 BDS 原版与常用日志本地化翻译（缺省为 true） */
  translate?: boolean;
  rules: LogFilterRule[];
}

export type LogFilterEntry = {
  text: string;
  source: string;
  level: LogLevel;
};

const DEFAULTS: LogFilterConfig = {
  enabled: false,
  mode: "drop",
  applyTo: "display",
  translate: true,
  rules: [],
};

export function logFilterConfigPath(): string {
  return path.join(ROOT, "configs", "log-filter.json");
}

/** 确保 configs/log-filter.json 存在（委托 SDK ensureSchemaConfig，禁止手写 withConfigSchema） */
export function ensureLogFilterConfigFile(): string {
  ensureSchemaConfig(ROOT, "log-filter.json", "log_filter", { ...DEFAULTS } as Record<string, unknown>);
  return logFilterConfigPath();
}

type CompiledRule = {
  sources?: Set<string>;
  levels?: Set<string>;
  contains?: string;
  regex?: RegExp;
  replace?: string;
};

export type CompiledFilter = {
  enabled: boolean;
  mode: LogFilterMode;
  applyTo: LogFilterApplyTo;
  translate: boolean;
  rules: CompiledRule[];
  mtimeMs: number;
};

let cache: CompiledFilter | null = null;

/** 将 (?i) 前缀转为 RegExp i 旗标（JS 无内联 (?i)） */
export function compileLogFilterRegex(src: string): RegExp | null {
  let pattern = String(src ?? "");
  let flags = "";
  if (pattern.startsWith("(?i)")) {
    pattern = pattern.slice(4);
    flags = "i";
  }
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function compileRules(rules: LogFilterRule[], onBadRegex?: (src: string) => void): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const r of rules) {
    if (r.enabled === false) continue;
    const hasAny =
      (r.sources && r.sources.length > 0) ||
      (r.levels && r.levels.length > 0) ||
      (typeof r.contains === "string" && r.contains.length > 0) ||
      (typeof r.regex === "string" && r.regex.length > 0) ||
      (typeof r.replace === "string" && r.replace.length > 0);
    if (!hasAny) continue;

    const compiled: CompiledRule = {};
    if (r.sources && r.sources.length > 0) {
      compiled.sources = new Set(r.sources.map((s) => s.toLowerCase()));
    }
    if (r.levels && r.levels.length > 0) {
      compiled.levels = new Set(r.levels.map((l) => l.toLowerCase()));
    }
    if (typeof r.contains === "string" && r.contains.length > 0) {
      compiled.contains = r.contains;
    }
    if (typeof r.regex === "string" && r.regex.length > 0) {
      const re = compileLogFilterRegex(r.regex);
      if (!re) {
        onBadRegex?.(r.regex);
        continue;
      }
      compiled.regex = re;
    }
    if (typeof r.replace === "string") {
      compiled.replace = r.replace;
    }
    out.push(compiled);
  }
  return out;
}

function normalizeConfig(raw: Record<string, unknown>): LogFilterConfig {
  const stripped = stripConfigMeta(raw);
  const mode = stripped.mode === "keep" ? "keep" : "drop";
  const applyTo = stripped.applyTo === "all" ? "all" : "display";
  const translate = stripped.translate !== undefined ? Boolean(stripped.translate) : true;
  const rules = Array.isArray(stripped.rules) ? (stripped.rules as LogFilterRule[]) : [];
  return {
    enabled: Boolean(stripped.enabled),
    mode,
    applyTo,
    translate,
    rules,
  };
}

/**
 * 加载并编译过滤配置（按文件 mtime 热读）。
 * onBadRegex：正则非法时回调（由 logs 层打 warn，避免循环依赖）。
 */
export function getCompiledLogFilter(onBadRegex?: (src: string) => void): CompiledFilter {
  const p = ensureLogFilterConfigFile();
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(p).mtimeMs;
  } catch {
    mtimeMs = 0;
  }
  if (cache && cache.mtimeMs === mtimeMs) return cache;

  let cfg = { ...DEFAULTS };
  const raw = readJson<Record<string, unknown>>(p);
  if (raw) {
    try {
      cfg = normalizeConfig(raw);
    } catch {
      cfg = { ...DEFAULTS };
    }
  }

  const rules = compileRules(cfg.rules, onBadRegex);

  cache = {
    enabled: cfg.enabled,
    mode: cfg.mode,
    applyTo: cfg.applyTo,
    translate: cfg.translate ?? true,
    rules,
    mtimeMs,
  };
  return cache;
}

/** 单条规则是否命中（同条 AND） */
export function ruleMatchesEntry(rule: CompiledRule, entry: LogFilterEntry): boolean {
  if (rule.sources && !rule.sources.has(entry.source.toLowerCase())) return false;
  if (rule.levels && !rule.levels.has(entry.level.toLowerCase())) return false;
  if (rule.contains != null && !entry.text.includes(rule.contains)) return false;
  if (rule.regex && !rule.regex.test(entry.text)) return false;
  return true;
}

/** 任一规则命中即为 matched */
export function entryMatchesAnyRule(entry: LogFilterEntry, rules: CompiledRule[]): boolean {
  if (rules.length === 0) return false;
  return rules.some((r) => ruleMatchesEntry(r, entry));
}

/**
 * 是否应丢弃该条（对展示/内存而言）。
 * enabled=false → 不丢；keep 模式未匹配 → 丢；drop 模式匹配 → 丢。
 */
export function shouldDropForDisplay(entry: LogFilterEntry, filter: CompiledFilter): boolean {
  if (!filter.enabled) return false;
  const matched = entryMatchesAnyRule(entry, filter.rules);
  if (filter.mode === "keep") return !matched;
  return matched;
}

/** 是否应跳过落盘（仅 applyTo=all 时与 display 一致） */
export function shouldDropForDisk(entry: LogFilterEntry, filter: CompiledFilter): boolean {
  if (filter.applyTo !== "all") return false;
  return shouldDropForDisplay(entry, filter);
}

/**
 * 对日志条目应用转换/本地化翻译：
 * 1. 优先匹配 rules 中带有 replace 的自定义规则（支持 $1, $2 捕获组）
 * 2. 若未被自定义规则替换且启用了 translate（且 source 为 bds），调用内建 BDS 翻译引擎
 */
export function transformLogEntry(
  entry: LogFilterEntry,
  filter?: CompiledFilter,
  locale?: string
): { entry: LogFilterEntry; transformed: boolean } {
  // 1. 自定义规则 replace 替换优先
  if (filter && filter.rules.length > 0) {
    for (const rule of filter.rules) {
      if (rule.replace && ruleMatchesEntry(rule, entry)) {
        let newText = entry.text;
        if (rule.regex) {
          newText = applyRuleReplacement(entry.text, rule.regex, rule.replace);
        } else if (rule.contains) {
          newText = entry.text.replaceAll(rule.contains, rule.replace);
        } else {
          newText = rule.replace;
        }
        return {
          entry: { ...entry, text: newText },
          transformed: true,
        };
      }
    }
  }

  // 2. 内置 BDS 原版日志本地化翻译
  const translateEnabled = filter ? filter.translate : true;
  if (translateEnabled && entry.source.toLowerCase() === "bds") {
    let loc: string;
    try {
      loc = locale ?? getLocale();
    } catch {
      loc = locale ?? "zh-CN";
    }
    const res = translateBdsLog(entry.text, loc);
    if (res.translated) {
      return {
        entry: { ...entry, text: res.text },
        transformed: true,
      };
    }
  }

  return { entry, transformed: false };
}

/** 测试用：清空缓存 */
export function resetLogFilterCacheForTests(): void {
  cache = null;
}

/**
 * 纯函数判定（不读盘）：供单测与调用方表驱动。
 * dropDisplay / dropDisk 语义与 pushLog 一致。
 */
export function evaluateLogFilter(
  entry: LogFilterEntry,
  cfg: LogFilterConfig,
  locale?: string
): {
  dropDisplay: boolean;
  dropDisk: boolean;
  matched: boolean;
  transformedEntry: LogFilterEntry;
} {
  const compiled: CompiledFilter = {
    enabled: cfg.enabled,
    mode: cfg.mode,
    applyTo: cfg.applyTo,
    translate: cfg.translate ?? true,
    rules: compileRules(cfg.rules),
    mtimeMs: 0,
  };
  const transformRes = transformLogEntry(entry, compiled, locale);
  return {
    matched: entryMatchesAnyRule(entry, compiled.rules),
    dropDisplay: shouldDropForDisplay(entry, compiled),
    dropDisk: shouldDropForDisk(entry, compiled),
    transformedEntry: transformRes.entry,
  };
}
