import { configPath, patchJson, readJson, type RuntimeConfig } from "@sfmc-bds/sdk/node/config";
import { ROOT } from "./runtime.js";

/**
 * 开发模式门面 —— 持久化在 `configs/runtime.json#developer_mode`。
 *
 * - 读取：`isDeveloperMode()` 默认 false
 * - 写入：`setDeveloperMode(root, on)` 浅合并到 runtime.json（与 `locale` 同契约）
 *
 * 该字段是 sfmc CLI 开发者子命令可见性的唯一权威来源；
 * REPL/帮助/补全/分发都必须通过 {@link isDeveloperMode} 读取，禁止直读 runtime.json。
 */
const DEV_FIELD = "developer_mode" as const;

type DeveloperModeConfig = { developer_mode?: boolean };

/** 读取开发模式开关；未设置或非 true 一律视为关闭。 */
export function isDeveloperMode(root: string = ROOT): boolean {
  const cfg = readJson<RuntimeConfig & DeveloperModeConfig>(configPath(root, "runtime.json"));
  return cfg?.[DEV_FIELD] === true;
}

/** 设置开发模式开关；浅合并到 runtime.json（不破坏其它字段）。 */
export function setDeveloperMode(root: string, on: boolean): void {
  patchJson<RuntimeConfig & DeveloperModeConfig>(configPath(root, "runtime.json"), {
    [DEV_FIELD]: on,
  });
}
