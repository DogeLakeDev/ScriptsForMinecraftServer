/**
 * server-properties.ts — BDS server.properties 辅助工具集
 *
 * 职责：
 * 1. 安装/启动时确保 emit-server-telemetry=true
 * 2. 安装/更新/启动时支持将配置注释结构化本地化（如翻译为简体中文 zh-CN），
 *    严格保留所有配置键（Key）与用户配置值（Value）。
 */
import { configPath, readJson } from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import { serverPropertiesPath } from "./pack-manager.js";
import { ROOT_DIR } from "./paths.js";
import { getServerPropertyDoc } from "./server-properties-i18n.js";

export const EMIT_SERVER_TELEMETRY_KEY = "emit-server-telemetry";
export const EMIT_SERVER_TELEMETRY_LINE = "emit-server-telemetry=true";

export type ServerPropertiesLogger = {
  info: (msg: string) => void;
};

/**
 * 若 `<bdsRoot>/server.properties` 中尚无 emit-server-telemetry，则追加 `=true`。
 * 已有该键（任意值）则跳过。文件不存在时跳过（BDS 尚未解压）。
 * @returns true = 本次新追加；false = 跳过
 */
export function ensureEmitServerTelemetry(
  bdsRoot: string,
  logger?: ServerPropertiesLogger
): boolean {
  const file = serverPropertiesPath(bdsRoot);
  if (!fs.existsSync(file)) return false;

  let text = fs.readFileSync(file, "utf8");
  if (/^\s*emit-server-telemetry\s*=/im.test(text)) {
    return false;
  }

  if (text.length > 0 && !text.endsWith("\n")) {
    text += "\n";
  }
  text += `${EMIT_SERVER_TELEMETRY_LINE}\n`;
  fs.writeFileSync(file, text, "utf8");

  logger?.info(
    "已向 server.properties 追加 emit-server-telemetry=true（因您已同意 Mojang EULA，按协议启用服务器遥测）"
  );
  return true;
}

/**
 * 解析并探测当前应当采用的 BDS 本地化语言代码（例如 zh-CN 或 en）。
 */
export function resolveBdsLocale(rootDir?: string): string {
  const envLang = process.env.SFMC_LOCALE || process.env.SFMC_LANG;
  if (envLang) {
    return envLang;
  }

  const root = rootDir || ROOT_DIR;
  try {
    const runtime = readJson<{ locale?: string }>(configPath(root, "runtime.json"));
    if (runtime?.locale) {
      return runtime.locale;
    }
  } catch {
    // 忽略异常，降级到系统语言探测
  }

  const osLangs = [
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    Intl.DateTimeFormat().resolvedOptions().locale,
  ];
  for (const raw of osLangs) {
    if (raw && /^zh\b/i.test(raw)) {
      return "zh-CN";
    }
  }
  return "en";
}

/**
 * 纯函数：将 server.properties 文本中的注释替换为目标语言的结构化中文说明。
 * 严格保留配置项的 key 与当前生效的 value。若遇到未收录的键或纯注释块，原样保留。
 */
export function localizeServerPropertiesContent(
  text: string,
  locale: string = "zh-CN"
): { content: string; modified: boolean } {
  const normalizedLocale = locale.toLowerCase();
  // 目前仅对中文做本地化重写；英文或其他语言保持原汁原味
  if (!normalizedLocale.startsWith("zh")) {
    return { content: text, modified: false };
  }

  if (!text || text.trim().length === 0) {
    return { content: text, modified: false };
  }

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);

  interface Block {
    key: string | undefined;
    value: string | undefined;
    originalLines: string[];
  }

  const blocks: Block[] = [];
  let currentBlock: string[] = [];
  let currentKey: string | undefined;
  let currentValue: string | undefined;

  function flushBlock() {
    if (currentBlock.length > 0) {
      blocks.push({
        key: currentKey,
        value: currentValue,
        originalLines: currentBlock,
      });
      currentBlock = [];
      currentKey = undefined;
      currentValue = undefined;
    }
  }

  const kvRegex = /^\s*([A-Za-z0-9._-]+)\s*=\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typeof line !== "string") continue;
    const isBlank = line.trim() === "";

    if (isBlank) {
      flushBlock();
      continue;
    }

    const match = line.match(kvRegex);
    if (match && match[1] !== undefined) {
      // 若当前块内已经存在一个键值对，则先结算上一块
      if (currentKey !== undefined) {
        flushBlock();
      }
      currentKey = match[1];
      currentValue = match[2] ?? "";
      currentBlock.push(line);
    } else {
      currentBlock.push(line);
    }
  }
  flushBlock();

  const outputBlocks: string[] = [];

  for (const block of blocks) {
    if (block.key) {
      const doc = getServerPropertyDoc(block.key, locale);
      if (doc) {
        const outLines: string[] = [`${block.key}=${block.value ?? ""}`];
        outLines.push(`# ${doc.desc}`);
        if (doc.values) {
          outLines.push(`# 可选值：${doc.values}`);
        }
        if (doc.tip) {
          outLines.push(`# 提示：${doc.tip}`);
        }
        outputBlocks.push(outLines.join(eol));
        continue;
      }
    }
    // 未收录的项或普通注释块，保留原文本
    outputBlocks.push(block.originalLines.join(eol));
  }

  let newContent = outputBlocks.join(eol + eol);
  if (newContent.length > 0 && !newContent.endsWith(eol)) {
    newContent += eol;
  }

  return {
    content: newContent,
    modified: newContent !== text,
  };
}

export interface LocalizeServerPropertiesOptions {
  locale?: string;
  rootDir?: string;
  logger?: ServerPropertiesLogger;
}

/**
 * 对 `<bdsRoot>/server.properties` 中的注释执行本地化重写。
 * @returns true = 本次成功重写并保存；false = 跳过或无改动
 */
export function localizeServerProperties(
  bdsRoot: string,
  options?: LocalizeServerPropertiesOptions
): boolean {
  const file = serverPropertiesPath(bdsRoot);
  if (!fs.existsSync(file)) return false;

  const locale = options?.locale || resolveBdsLocale(options?.rootDir);
  const normalizedLocale = locale.toLowerCase();
  if (!normalizedLocale.startsWith("zh")) {
    return false;
  }

  const raw = fs.readFileSync(file, "utf8");
  const { content, modified } = localizeServerPropertiesContent(raw, locale);
  if (!modified) {
    return false;
  }

  fs.writeFileSync(file, content, "utf8");
  options?.logger?.info("已将 server.properties 中的注释本地化为简体中文（保留所有既有配置值）");
  return true;
}
