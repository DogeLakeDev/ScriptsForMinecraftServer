/**
 * send-target.ts — REPL 发送目标（活跃服务间 Tab 切换）
 */
import chalk from "chalk";
import { serviceStatus, type ServiceName } from "./services.js";
import { T } from "./theme.js";

/** 可发送目标顺序 */
export const SEND_TARGET_ORDER: readonly ServiceName[] = ["bds", "db", "qq", "llbot"];

const SHORT: Record<ServiceName, string> = {
  bds: "BDS",
  db: "DB",
  qq: "QQ",
  llbot: "LLBOT",
};

/** 与 log 源配色一致，用作提示符底色 */
const BG: Record<ServiceName, string> = {
  bds: T.green,
  db: T.blue,
  qq: T.purple,
  llbot: T.yellow,
};

export function sendTargetShort(name: ServiceName): string {
  return SHORT[name];
}

/** ` BDS ❯ ` 整块底色高亮；块后再加空格，避免与输入粘连 */
export function paintSendPrompt(name: ServiceName): string {
  return chalk.bgHex(BG[name]).hex(T.bg)(` ${SHORT[name]} ❯ `) + " ";
}

export function plainPrompt(): string {
  return chalk.hex(T.text)(" ❯ ");
}

/** 当前可发送的活跃服务 */
export async function listActiveSendTargets(): Promise<ServiceName[]> {
  const rows = await serviceStatus();
  const running = new Set(rows.filter((r) => r.running).map((r) => r.name));
  return SEND_TARGET_ORDER.filter((n) => running.has(n));
}
