/**
 * 平台内置 QQ 绑定模块 — 游戏内绑定、游玩门槛、事件上报与账号快照。
 *
 * 使用场景：随平台 `modules/packages/qq-link` 安装，不再作为独立市场模块分发。
 *
 * 流程（绑定）：
 *   1. QQ 侧发「绑定」取得短码
 *   2. 游戏内 /c:bind → 等待态 → 下一条聊天码 → confirm
 *
 * 流程（游玩门槛）：
 *   关闭原版 allow-list。未绑定可进服，但是访客且不能移动，聊天栏提示绑定。
 *   QQ 绑定成功写入绑定表后解除限制。
 *
 * 流程（事件）：
 *   join/leave/death → POST /api/sfmc/qq/events（db-server 聚合推群）
 *
 * 聊天互通由聊天模块按频道的「转发到 QQ」和 QQ 消息来源处理，本模块不再读取已删除的 bridge_channel_id。
 */

import { Player, system, world } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { ModuleRegistry, type ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import { Command, HttpDB, Msg, Permission } from "@sfmc-bds/sdk/sapi/runtime";
import { startAccountProfileReporter } from "./account-profile.js";
import { registerGameEventReporters, startLiveStatusReporter } from "./events.js";
import { markBoundAndRelease, startPlayGate, stopPlayGate } from "./play-gate.js";
import { formatConfirmError } from "./util.js";

/** 与 sapi/manifest.json 的 id 一致 */
export const MODULE_ID = "feature-qq-link";

/** 命令权限名 */
export const PERM = "qq_link.use";

/** 等待绑定码超时（tick；20 tick ≈ 1s） */
export const BIND_WAIT_TICKS = 20 * 60;

type PendingBind = {
  timeoutId: number;
};

const pendingByPlayer = new Map<string, PendingBind>();
const intervalIds: number[] = [];

/** 保存订阅回调，cleanup 时 unsubscribe */
let onChatSend: ((ev: { sender?: Player; message?: string; cancel?: boolean }) => void) | null = null;
/** 游戏事件上报的取消函数 */
let unsubGameEvents: (() => void) | null = null;

function clearPending(playerId: string): void {
  const p = pendingByPlayer.get(playerId);
  if (!p) return;
  try {
    system.clearRun(p.timeoutId);
  } catch {
    /* ignore */
  }
  pendingByPlayer.delete(playerId);
}

export { formatConfirmError };

/** 调用平台 confirm（单测可 mock HttpDB） */
export async function postBindConfirm(
  player: { id: string; name: string },
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await HttpDB.typedRequest<{ success?: boolean; error?: string }>(
    HttpRequestMethod.POST,
    "/api/sfmc/qq/bind/confirm",
    {
      code,
      xuid: player.id,
      name: player.name,
    }
  );
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error || "request_failed" };
}

function beginWait(player: Player): void {
  const id = player.id;
  clearPending(id);
  // 跨包 @minecraft/server 类型身份不一致（file: SDK vs 本仓），运行时同一 stub
  Msg.info("请在 60 秒内发送绑定码", player as never);
  const timeoutId = system.runTimeout(() => {
    if (!pendingByPlayer.has(id)) return;
    pendingByPlayer.delete(id);
    try {
      const online = world.getAllPlayers().find((p) => p.id === id);
      if (online) Msg.warning("绑定等待已超时，请重新输入 /c:bind", online as never);
    } catch {
      /* ignore */
    }
  }, BIND_WAIT_TICKS);
  pendingByPlayer.set(id, { timeoutId });
}

function registerPermissions(): void {
  Permission.register(PERM, Permission.Any);
}

function registerCommands(): void {
  Command.register(
    "bind",
    PERM,
    (player) => {
      if (!player) return;
      beginWait(player as Player);
    },
    "绑定 QQ（随后发送验证码）",
    MODULE_ID
  );
}

function registerEvents(): void {
  onChatSend = (ev) => {
    const player = ev.sender;
    if (!player) return;
    if (!pendingByPlayer.has(player.id)) return;

    const raw = String(ev.message ?? "").trim();
    if (raw.startsWith("!") || raw.startsWith("！")) return;

    ev.cancel = true;
    clearPending(player.id);

    const code = raw.replace(/\s+/g, "");
    if (!/^\d{4,8}$/.test(code)) {
      Msg.error("绑定码应为 4–8 位数字，请重新 /c:bind 后再发", player as never);
      return;
    }

    system.run(() => {
      void (async () => {
        const result = await postBindConfirm(player, code);
        // await 之后回到脚本线程再改权限和发消息。
        system.run(() => {
          if (result.ok) {
            markBoundAndRelease(player);
            Msg.success("QQ 绑定成功，已加入白名单，可以自由活动", player as never);
          } else {
            Msg.error(formatConfirmError(result.error), player as never);
          }
        });
      })();
    });
  };
  world.beforeEvents.chatSend.subscribe(onChatSend as never);

  // 上下线 / 死亡 → db-server 聚合推群
  unsubGameEvents = registerGameEventReporters();
}

function init(): void {
  startPlayGate();
  intervalIds.push(startLiveStatusReporter());
  intervalIds.push(startAccountProfileReporter());
}

function cleanup(): void {
  stopPlayGate();
  for (const id of [...pendingByPlayer.keys()]) {
    clearPending(id);
  }
  for (const runId of intervalIds) {
    try {
      system.clearRun(runId);
    } catch {
      /* ignore */
    }
  }
  intervalIds.length = 0;
  if (onChatSend) {
    try {
      world.beforeEvents.chatSend.unsubscribe(onChatSend as never);
    } catch {
      /* ignore */
    }
    onChatSend = null;
  }
  if (unsubGameEvents) {
    try {
      unsubGameEvents();
    } catch {
      /* ignore */
    }
    unsubGameEvents = null;
  }
}

registerCommands();

export const DESCRIPTOR: ModuleDescriptor = {
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions,
    registerEvents,
    init,
    cleanup,
  },
};

ModuleRegistry.register(DESCRIPTOR);
