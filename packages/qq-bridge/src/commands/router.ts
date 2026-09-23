import { randomUUID } from "node:crypto";
import { log } from "../log.js";
import { formatCard } from "./menu-format.js";
import type { PendingChoiceStore } from "./pending.js";
import { authorizeAdmin } from "./permissions.js";
import { normalizeTrigger, type CommandRegistry } from "./registry.js";
import type { CommandContext, CommandResult, InboundMessage, ReplyPort } from "./types.js";

export type CommandRouterOptions = {
  registry: CommandRegistry;
  pending: PendingChoiceStore;
  reply: ReplyPort;
  startedAt: number;
  runtimeInfo: CommandContext["runtimeInfo"];
};
type Confirmation = {
  token: string;
  expiresAt: number;
  execute: NonNullable<CommandResult["confirmation"]>["execute"];
  admin: boolean;
};
export class CommandRouter {
  private readonly confirmations = new Map<string, Confirmation>();
  private readonly queues = new Map<string, Promise<unknown>>();
  constructor(private readonly opts: CommandRouterOptions) {}
  get registry(): CommandRegistry {
    return this.opts.registry;
  }

  /** 同一人的请求串行处理，避免旧回复覆盖新菜单及重复确认。 */
  async handle(inbound: InboundMessage): Promise<boolean> {
    const key = JSON.stringify([inbound.backend, inbound.groupId, inbound.userId]);
    const previous = this.queues.get(key) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => this.dispatch(inbound, key));
    this.queues.set(key, task);
    try {
      return await task;
    } finally {
      if (this.queues.get(key) === task) this.queues.delete(key);
    }
  }
  private async dispatch(inbound: InboundMessage, key: string): Promise<boolean> {
    const raw = String(inbound.text ?? "").trim();
    if (!raw) return false;
    let effective = inbound;
    if (/^\d+$/.test(raw) && inbound.backend === "llbot") {
      const choice = this.opts.pending.choose(inbound.backend, inbound.groupId, inbound.userId, Number(raw));
      if (choice.kind === "missing") return false;
      if (choice.kind !== "chosen") {
        await this.send(
          inbound,
          {
            text:
              choice.kind === "expired"
                ? "菜单已过期，请发送「菜单」重新打开。"
                : "没有这个编号，请选择当前菜单中的编号。",
          },
          false
        );
        return true;
      }
      effective = { ...inbound, text: choice.command };
    }
    const text = effective.text.trim().replace(/^[/／]+/, "");
    const confirmationMatch = /^(confirm|确认|cancel|取消)(?:\s+(\S+))?$/i.exec(text);
    const resolved = this.registry.resolve(text);
    if (!confirmationMatch && !resolved) {
      if (!/^[/／]/.test(raw)) return false;
      this.confirmations.delete(key);
      await this.send(inbound, { text: "没有找到这个指令。发送「帮助」查看可用命令，或发送「菜单」返回首页。" });
      return true;
    }
    const ctx: CommandContext = {
      inbound: effective,
      startedAt: this.opts.startedAt,
      runtimeInfo: this.opts.runtimeInfo,
    };
    try {
      let result: CommandResult;
      if (confirmationMatch) {
        const pending = this.confirmations.get(key);
        const token = confirmationMatch[2];
        if (!pending || Date.now() >= pending.expiresAt || (token && token !== pending.token)) {
          if (pending && Date.now() >= pending.expiresAt) this.confirmations.delete(key);
          await this.send(inbound, { text: "此确认已失效或不属于你，请重新发起操作。" }, false);
          return true;
        }
        this.confirmations.delete(key);
        if (/^(cancel|取消)$/i.test(confirmationMatch[1]!)) {
          result = { text: "已取消操作。" };
        } else {
          ctx.adminAuthorized = pending.admin ? await authorizeAdmin(ctx) : false;
          result =
            pending.admin && !ctx.adminAuthorized
              ? { text: "当前没有管理权限或暂时无法核验，请联系管理员或稍后重新发起操作。" }
              : await pending.execute(ctx);
        }
      } else if (resolved) {
        this.confirmations.delete(key);
        // 仅规范化首词，保留玩家名等参数的大小写。
        ctx.inbound = { ...effective, text: text.replace(/^\S+/, resolved.name) };
        ctx.adminAuthorized =
          resolved.permission === "admin" || resolved.name === "menu" || resolved.name === "help"
            ? await authorizeAdmin(ctx)
            : false;
        result =
          resolved.permission === "admin" && !ctx.adminAuthorized
            ? { text: "当前没有管理权限或暂时无法核验，请联系管理员或稍后重试。" }
            : await resolved.handler(ctx);
        if (result.confirmation) {
          for (const [oldKey, entry] of this.confirmations) {
            if (entry.expiresAt <= Date.now()) this.confirmations.delete(oldKey);
          }
          const token = randomUUID();
          this.confirmations.set(key, {
            token,
            expiresAt: Date.now() + 60_000,
            execute: result.confirmation.execute,
            admin: resolved.permission === "admin",
          });
          result = {
            ...formatCard("操作确认", [result.confirmation.summary, "", "请本人在 60 秒内确认，或取消操作。"]),
            buttons: [
              { id: "confirm", label: "确认操作", command: `/confirm ${token}` },
              { id: "cancel", label: "取消", command: `/cancel ${token}` },
            ],
          };
        }
      } else return false;
      if (!(await this.send(inbound, result))) this.confirmations.delete(key);
    } catch (error) {
      log.warn(`指令处理失败: ${String(error)}`);
      await this.send(inbound, { text: "操作暂时未完成，请稍后查询当前状态；涉及修改时请勿连续重复提交。" });
    }
    return true;
  }
  private async send(inbound: InboundMessage, result: CommandResult, replaceMenu = true): Promise<boolean> {
    if (replaceMenu) {
      const buttons = [...(result.buttons ?? [])];
      if (result.menu !== "home" && !buttons.some((button) => button.command === "/menu"))
        buttons.push({ id: "home", label: "返回首页", command: "/menu" });
      result = {
        ...result,
        buttons: buttons.map((button) => ({ ...button, permission: { type: 0, specify_user_ids: [inbound.userId] } })),
      };
      this.opts.pending.clear(inbound.backend, inbound.groupId, inbound.userId);
    }
    try {
      await this.opts.reply.send(
        { groupId: inbound.groupId, ...(inbound.msgId ? { msgId: inbound.msgId } : {}) },
        result,
        inbound
      );
      if (replaceMenu && inbound.backend === "llbot" && result.buttons?.length) {
        this.opts.pending.set(
          inbound.backend,
          inbound.groupId,
          inbound.userId,
          new Map(result.buttons.map((button, index) => [index + 1, button.command]))
        );
      }
      return true;
    } catch (error) {
      log.warn(`指令回复失败: ${String(error)}`);
      return false;
    }
  }
}
export { normalizeTrigger };
