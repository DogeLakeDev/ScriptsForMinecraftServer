/**
 * debug-command.ts — sfmc debug 顶层命令
 *
 * 读写 BDS 端 `config/default/variables.json` 与 `config/default/secrets.json`：
 *   - `sfmc_debug`   —— SDK `applyDebugFromVariables()` 在启动时读取
 *   - `SENTRY_DSN`   —— SDK `initSentryIfConfigured()` 在启动时读取
 *
 * 本文件只改 BDS 配置；不触碰 SDK 现有 `applyDebugFromVariables` /
 * `initSentryIfConfigured` 语义（OCP：CLI = 配置入口，SDK = 运行时入口）。
 * 改完后需 `sfmc mod reload` 或重启 BDS 才会在行为包生效。
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { resolveBdsContext } from "./pack-lifecycle.js";
import { c } from "./theme.js";
import { t } from "./i18n/index.js";

const VARIABLES_PATH = path.join("config", "default", "variables.json");
const SECRETS_PATH = path.join("config", "default", "secrets.json");

type VariablesDoc = Record<string, unknown>;
type SecretsDoc = Record<string, unknown>;

async function readJsonOrEmpty<T extends object>(filePath: string): Promise<T> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function writeJsonAtomic(filePath: string, value: object): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

async function readBdsConfig(): Promise<{
  variables: VariablesDoc;
  secrets: SecretsDoc;
  variablesPath: string;
  secretsPath: string;
}> {
  const { bdsRoot } = resolveBdsContext();
  const variablesPath = path.join(bdsRoot, VARIABLES_PATH);
  const secretsPath = path.join(bdsRoot, SECRETS_PATH);
  const variables = await readJsonOrEmpty<VariablesDoc>(variablesPath);
  const secrets = await readJsonOrEmpty<SecretsDoc>(secretsPath);
  return { variables, secrets, variablesPath, secretsPath };
}

function asBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string" && ["true", "1", "yes", "on"].includes(v.trim().toLowerCase())) {
    return true;
  }
  return false;
}

function onOffLabel(on: boolean): string {
  return on ? c.green(t("debug.state.on")) : c.dim(t("debug.state.off"));
}

/** `sfmc debug status` —— 展示当前 sfmc_debug / SENTRY_DSN。 */
async function cmdDebugStatus(): Promise<string> {
  const { variables, secrets } = await readBdsConfig();
  const lines = [c.bold(`\n${t("debug.statusTitle")}`)];
  lines.push(
    `  ${c.text("sfmc_debug")}  : ${onOffLabel(asBool(variables.sfmc_debug))}  ${c.dim("(BDS variables.json)")}`
  );
  const dsn = secrets.SENTRY_DSN;
  if (typeof dsn === "string" && dsn.length > 0) {
    const masked = dsn.length > 12 ? `${dsn.slice(0, 8)}…${dsn.slice(-4)}` : dsn;
    lines.push(`  ${c.text("SENTRY_DSN")}   : ${c.green(t("debug.state.on"))}  ${c.dim(`(${masked})`)}`);
  } else {
    lines.push(`  ${c.text("SENTRY_DSN")}   : ${c.dim(t("debug.state.off"))}`);
  }
  lines.push(c.dim(`\n  ${t("debug.reloadHint")}`));
  return lines.join("\n") + "\n";
}

/** `sfmc debug enable` —— 写 sfmc_debug: true。 */
async function cmdDebugEnable(): Promise<string> {
  const { variables, variablesPath } = await readBdsConfig();
  variables.sfmc_debug = true;
  await writeJsonAtomic(variablesPath, variables);
  return c.green(t("debug.enabled")) + "\n" + c.dim(t("debug.reloadHint"));
}

/** `sfmc debug disable` —— 写 sfmc_debug: false；不动 SENTRY_DSN。 */
async function cmdDebugDisable(): Promise<string> {
  const { variables, variablesPath } = await readBdsConfig();
  variables.sfmc_debug = false;
  await writeJsonAtomic(variablesPath, variables);
  return c.yellow(t("debug.disabled")) + "\n" + c.dim(t("debug.reloadHint"));
}

/** `sfmc debug sentry on --dsn <dsn>` —— 写入 SENTRY_DSN。 */
async function cmdDebugSentryOn(args: string[]): Promise<string> {
  let dsn: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dsn") dsn = args[++i];
    else if (a?.startsWith("--dsn=")) dsn = a.slice("--dsn=".length);
  }
  if (!dsn) {
    return c.red(t("debug.sentry.dsnMissing")) + "\n" + c.dim(t("debug.sentry.usage"));
  }
  const { secrets, secretsPath } = await readBdsConfig();
  secrets.SENTRY_DSN = dsn;
  await writeJsonAtomic(secretsPath, secrets);
  const masked = dsn.length > 12 ? `${dsn.slice(0, 8)}…${dsn.slice(-4)}` : dsn;
  return c.green(t("debug.sentry.set", { dsn: masked })) + "\n" + c.dim(t("debug.reloadHint"));
}

/** `sfmc debug sentry off` —— 删除 SENTRY_DSN。 */
async function cmdDebugSentryOff(): Promise<string> {
  const { secrets, secretsPath } = await readBdsConfig();
  if (!("SENTRY_DSN" in secrets)) {
    return c.dim(t("debug.sentry.alreadyOff"));
  }
  delete secrets.SENTRY_DSN;
  await writeJsonAtomic(secretsPath, secrets);
  return c.yellow(t("debug.sentry.removed")) + "\n" + c.dim(t("debug.reloadHint"));
}

/** `sfmc debug [status|enable|disable|sentry on|off]` —— BDS 调试配置入口。 */
export async function cmdDebug(args: string[]): Promise<string> {
  const sub = args[0]?.toLowerCase();
  try {
    if (!sub || sub === "status") return await cmdDebugStatus();
    if (sub === "enable") return await cmdDebugEnable();
    if (sub === "disable") return await cmdDebugDisable();
    if (sub === "sentry") {
      const action = args[1]?.toLowerCase();
      if (action === "on") return await cmdDebugSentryOn(args.slice(2));
      if (action === "off") return await cmdDebugSentryOff();
      return c.red(t("debug.sentry.unknown", { action: action ?? "" })) + "\n" + c.dim(t("debug.sentry.usage"));
    }
    return (
      c.red(t("debug.unknown", { sub })) +
      "\n" +
      c.dim(t("debug.usage"))
    );
  } catch (e) {
    return c.red((e as Error).message);
  }
}