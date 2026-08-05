/**
 * sfmc CLI 多语言（中英双语）
 *
 * 优先级: --lang / --locale 旗标 > SFMC_LOCALE / SFMC_LANG 环境变量
 *        > configs/runtime.json#locale > 系统语言（zh* → zh-CN，否则 en）
 */
import { configPath, patchJson, readJson, type RuntimeConfig } from "@sfmc-bds/sdk/node/config";
import { en, type MessageKey } from "./locales/en.js";
import { zhCN } from "./locales/zh-CN.js";
import { normalizeLocale, type Locale } from "./types.js";

export type { Locale, MessageKey };
export { isLocale, normalizeLocale, LOCALES } from "./types.js";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  "zh-CN": zhCN,
};

let active: Locale = "zh-CN";
let initialized = false;

export function getLocale(): Locale {
  return active;
}

export function setLocale(locale: Locale): void {
  active = locale;
  initialized = true;
}

function detectOsLocale(): Locale {
  const candidates = [
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    Intl.DateTimeFormat().resolvedOptions().locale,
  ];
  for (const raw of candidates) {
    const n = normalizeLocale(raw?.split(".")[0]);
    if (n) return n;
    if (raw && /^zh\b/i.test(raw)) return "zh-CN";
  }
  return "en";
}

function readRuntimeLocale(root: string): Locale | null {
  try {
    const runtime = readJson<RuntimeConfig & { locale?: string }>(configPath(root, "runtime.json"));
    return normalizeLocale(runtime?.locale ?? null);
  } catch {
    return null;
  }
}

/**
 * 从 argv 剥离 `--lang=` / `--locale=` / `--lang x`，返回剩余参数与解析到的语言。
 */
export function stripLangArgs(argv: string[]): { args: string[]; lang: Locale | null } {
  const args: string[] = [];
  let lang: Locale | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--lang" || a === "--locale") {
      const next = argv[i + 1];
      const n = normalizeLocale(next);
      if (n) {
        lang = n;
        i++;
        continue;
      }
      args.push(a);
      continue;
    }
    const m = /^--(?:lang|locale)=(.*)$/i.exec(a);
    if (m) {
      const n = normalizeLocale(m[1]);
      if (n) {
        lang = n;
        continue;
      }
    }
    args.push(a);
  }
  return { args, lang };
}

export type InitLocaleOptions = {
  /** 项目根（读 runtime.json） */
  root?: string;
  /** 已从 argv 解析的语言 */
  flag?: Locale | null;
};

/** 进程启动时调用一次；之后可用 setLocale / persistLocale 切换。 */
export function initLocale(opts: InitLocaleOptions = {}): Locale {
  const fromEnv = normalizeLocale(process.env.SFMC_LOCALE ?? process.env.SFMC_LANG ?? null);
  const fromFlag = opts.flag ?? null;
  const fromRuntime = opts.root ? readRuntimeLocale(opts.root) : null;
  const locale = fromFlag ?? fromEnv ?? fromRuntime ?? detectOsLocale();
  setLocale(locale);
  return locale;
}

/** 写入 configs/runtime.json#locale（浅合并，不破坏其它字段）。 */
export function persistLocale(root: string, locale: Locale): void {
  patchJson(configPath(root, "runtime.json"), { locale } as Partial<RuntimeConfig & { locale: string }>);
  setLocale(locale);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
}

/** 取当前语言文案；缺键时回退英文。 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  if (!initialized) {
    /* 懒初始化：允许在 initLocale 前被 import 的模块调用 */
    initLocale();
  }
  const catalog = catalogs[active] ?? catalogs.en;
  const raw = catalog[key] ?? catalogs.en[key] ?? String(key);
  return interpolate(raw, params);
}
