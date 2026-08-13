/**
 * commands/index.ts — 组装默认 Router
 */

import { registerBuiltinCommands } from "./handlers.js";
import { PendingChoiceStore } from "./pending.js";
import { CommandRegistry } from "./registry.js";
import { createLlbotReplyPort, type LlbotReplyConfig } from "./reply-llbot.js";
import { createOfficialReplyPort } from "./reply-official.js";
import { CommandRouter } from "./router.js";
import type { CommandContext, ReplyPort } from "./types.js";
import type { QqOfficialCredentials } from "@sfmc-bds/sdk/node/qq-official";

export type { CommandResult, InboundMessage, ReplyPort } from "./types.js";
export { CommandRouter } from "./router.js";
export { renderOfficial, renderLlbot } from "./render.js";
export { normalizeTrigger, CommandRegistry } from "./registry.js";
export { PendingChoiceStore } from "./pending.js";
export { registerBuiltinCommands } from "./handlers.js";
export { syncMenuAndPanel, buildMenuItems, buildPanelItems } from "./menu-panel-sync.js";

export function createCommandRouter(opts: {
  reply: ReplyPort;
  runtimeInfo: CommandContext["runtimeInfo"];
  startedAt?: number;
}): CommandRouter {
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  return new CommandRouter({
    registry,
    pending: new PendingChoiceStore(),
    reply: opts.reply,
    startedAt: opts.startedAt ?? Date.now(),
    runtimeInfo: opts.runtimeInfo,
  });
}

export function createOfficialCommandRouter(
  creds: QqOfficialCredentials,
  runtimeInfo: CommandContext["runtimeInfo"],
  startedAt?: number
): CommandRouter {
  const opts: Parameters<typeof createCommandRouter>[0] = {
    reply: createOfficialReplyPort(creds),
    runtimeInfo,
  };
  if (startedAt !== undefined) opts.startedAt = startedAt;
  return createCommandRouter(opts);
}

export function createLlbotCommandRouter(
  cfg: LlbotReplyConfig,
  runtimeInfo: CommandContext["runtimeInfo"] = {},
  startedAt?: number
): CommandRouter {
  const opts: Parameters<typeof createCommandRouter>[0] = {
    reply: createLlbotReplyPort(cfg),
    runtimeInfo,
  };
  if (startedAt !== undefined) opts.startedAt = startedAt;
  return createCommandRouter(opts);
}
