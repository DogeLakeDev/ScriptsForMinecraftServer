/**
 * commands/router.ts — 解析触发词 / 编号会话，执行 handler
 */

import { log } from "../log.js";
import type { PendingChoiceStore } from "./pending.js";
import { normalizeTrigger, type CommandRegistry } from "./registry.js";
import type {
  CommandContext,
  CommandResult,
  InboundMessage,
  ReplyPort,
  ReplyTarget,
} from "./types.js";

export type CommandRouterOptions = {
  registry: CommandRegistry;
  pending: PendingChoiceStore;
  reply: ReplyPort;
  startedAt: number;
  runtimeInfo: CommandContext["runtimeInfo"];
};

/**
 * 若文本为纯数字 1–9，尝试 pending；否则按触发词解析。
 * 命中并回复成功返回 true（调用方应拦截转发）。
 */
export class CommandRouter {
  private readonly opts: CommandRouterOptions;

  constructor(opts: CommandRouterOptions) {
    this.opts = opts;
  }

  /** 供 menu/panel sync 读取权威命令表 */
  get registry(): CommandRegistry {
    return this.opts.registry;
  }

  async handle(inbound: InboundMessage): Promise<boolean> {
    const raw = String(inbound.text ?? "").trim();
    if (!raw) return false;

    // 编号会话：用缓存的完整命令替换正文（含参数，如「配置 白名单 关」）
    let effective: InboundMessage = inbound;
    const digit = /^[1-9]$/.exec(raw);
    if (digit) {
      const chosen = this.opts.pending.take(inbound.backend, inbound.groupId, inbound.userId, Number(digit[0]));
      if (!chosen) return false;
      effective = { ...inbound, text: chosen };
    }

    const resolved = this.opts.registry.resolve(effective.text);
    if (!resolved) return false;

    const ctx: CommandContext = {
      inbound: effective,
      startedAt: this.opts.startedAt,
      runtimeInfo: this.opts.runtimeInfo,
    };
    const result: CommandResult = await resolved.handler(ctx);

    // llbot：有按钮时写入编号会话
    if (effective.backend === "llbot" && result.buttons && result.buttons.length > 0) {
      const choices = new Map<number, string>();
      result.buttons.forEach((b, i) => {
        choices.set(i + 1, b.command);
      });
      this.opts.pending.set(effective.backend, effective.groupId, effective.userId, choices);
    }

    const target: ReplyTarget = { groupId: effective.groupId };
    if (effective.msgId) target.msgId = effective.msgId;

    try {
      await this.opts.reply.send(target, result, effective);
      log.info(`cmd=${resolved.name} handled user=${effective.userId} group=${effective.groupId}`);
      return true;
    } catch (e) {
      log.warn(`cmd=${resolved.name} 回复失败: ${(e as Error).message}`);
      return true; // 仍视为已处理，避免再转去 MC
    }
  }
}

export { normalizeTrigger };
