/**
 * @sfmc-bds/sdk/testing — 模块测试沙箱（假引擎 + createSandbox）
 *
 * 须配合 `--import @sfmc-bds/sdk/testing/minecraft-loader`，使
 * `import from "@minecraft/server"` 落到可控假实现。
 */

export type { FakePlayer, FakePlayerInit } from "./engine/overrides/player.js";
export { createEnginePlayer as createFakePlayer } from "./engine/overrides/player.js";

export type { FakeWorld } from "./engine/overrides/world.js";
export { createFakeWorld } from "./engine/overrides/world.js";

export type { FakeDb, FakeDbStub, FakeDbTx } from "./fake-db.js";
export { createFakeDb } from "./fake-db.js";

export type { RunLifecycleOpts } from "./lifecycle.js";
export { runLifecycle, runCleanup } from "./lifecycle.js";

export type {
  CreateSandboxOpts,
  Sandbox,
  SandboxEmit,
  MemoryConfigsAll,
  MemoryDataAdapter,
  SandboxProgressStep,
  SandboxFixtureIntent,
} from "./sandbox.js";
export { createSandbox } from "./sandbox.js";

export type { SandboxFixtureSnapshot } from "./fixture.js";
export {
  applyFixtureIntent,
  buildFixtureSnapshot,
  configsFromFixtureIntent,
  FIXTURE_PERMISSION_LEVELS,
} from "./fixture.js";
export { createMemoryDataAdapter } from "./host/memory-data-adapter.js";

export { loadModuleDescriptor, resolveModuleEntry } from "./load-module.js";

export {
  installModuleLogBridge,
  shouldForwardModuleLog,
} from "./module-log-bridge.js";
export type { ModuleLogBridgeHandle, ModuleLogNotify } from "./module-log-bridge.js";

export { PLAYGROUND_META } from "./engine/generated/playground-meta.js";
export type { SandboxObjects, SandboxObjectHandle, SandboxObjectKind } from "./objects.js";
export type { SandboxEvents } from "./events-drive.js";

export { PlayerPermissionLevel } from "./engine/runtime.js";

export type { FormResponse } from "./engine/overrides/ui-host.js";
export { UnimplementedMinecraftApiError } from "./engine/unimplemented-error.js";

/** 断言某 fake player 收到含子串的某类 Msg 消息。 */
export function assertMsg(
  player: { log: string[] },
  includes: string,
  prefix = "§"
): boolean {
  return player.log.some((line) => line.includes(prefix) && line.includes(includes));
}

/** 把模块 entry 文件加载进 Node 测试运行时。 */
export async function importModuleEntry(path: string): Promise<unknown> {
  return import(path);
}

/** API 占位：Msg.* 走 player.sendMessage，无需额外 hook。 */
export function interceptMsgFor(player: { log: string[] }): void {
  void player;
}
