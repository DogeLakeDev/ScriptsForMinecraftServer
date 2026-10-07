/**
 * qq-link/index.ts — 平台内置 QQ 绑定、游玩门槛、事件上报与账号快照
 *
 * 使用场景：随行为包宿主 `installHostBootstrap` 启动，不再作为 modules/packages 模块。
 *
 * 流程（绑定）：
 *   1. QQ 侧发「绑定」取得短码
 *   2. 游戏内 /c:bind → 等待态 → 下一条聊天码 → confirm
 *
 * 流程（游玩门槛）：
 *   关闭原版 allow-list。未绑定可进服，但是访客且不能移动，聊天栏提示绑定。
 *
 * 流程（事件）：
 *   join/leave/death → POST /api/sfmc/qq/events（db-server 实时推群）
 */

import { Player, system, world } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { PLATFORM_SERVICE_OWNER } from "../../../contracts/platform-capabilities.js";
import { setDbModuleContext } from "../../db/client.js";
import { ConfigManager } from "../../../module-loader/internal/config-manager.js";
import { setServiceModuleContext } from "../../service/client.js";
import { Command } from "../command.js";
import { HttpDB } from "../httpdb.js";
import { Msg } from "../msg.js";
import { Permission } from "../permission.js";
import { startAccountProfileReporter } from "./account-profile.js";
import { registerGameEventReporters, startLiveStatusReporter } from "./events.js";
import { markBoundAndRelease, startPlayGate, stopPlayGate } from "./play-gate.js";
import { formatConfirmError } from "./util.js";

/** 命令权限名（兼容旧模块声明习惯） */
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
/** 命令/权限是否已注册（宿主只装一次） */
let commandsRegistered = false;
/** 世界侧能力是否已启动 */
let runtimeStarted = false;

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

/**
 * 注册 /c:bind 与权限；在宿主 install 阶段调用一次。
 * 当前场景：installHostBootstrap 与 status 命令对称注册。
 */
export function registerPlatformQqLinkCommands(): void {
  if (commandsRegistered) return;
  commandsRegistered = true;
  Permission.register(PERM, Permission.Any);
  Command.register(
    "bind",
    PERM,
    (player) => {
      if (!player) return;
      beginWait(player as Player);
    },
    "绑定 QQ（随后发送验证码）"
  );
}

function bindPlatformIdentity(): void {
  const token = ConfigManager.getModuleToken(PLATFORM_SERVICE_OWNER);
  setDbModuleContext(PLATFORM_SERVICE_OWNER, token);
  setServiceModuleContext(PLATFORM_SERVICE_OWNER, token, () => false);
}

function registerChatBindHandler(): void {
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
  unsubGameEvents = registerGameEventReporters();
}

/**
 * 世界加载后启动门禁、事件上报与定时同步。
 * @returns 停止函数，供 shutdown 调用。
 */
export function startPlatformQqLink(): () => void {
  if (runtimeStarted) return stopPlatformQqLink;
  runtimeStarted = true;
  bindPlatformIdentity();
  registerChatBindHandler();
  startPlayGate();
  intervalIds.push(startLiveStatusReporter());
  intervalIds.push(startAccountProfileReporter());
  return stopPlatformQqLink;
}

/** 关闭平台 QQ 绑定运行时（定时器、订阅、门禁）。 */
export function stopPlatformQqLink(): void {
  if (!runtimeStarted && pendingByPlayer.size === 0 && intervalIds.length === 0) return;
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
  runtimeStarted = false;
}
