/**
 * play-gate.ts — 自有白名单门禁
 *
 * 白名单即 QQ 绑定（GET /api/sfmc/qq/bind/me?xuid=）。
 * 模块加载后关闭原版 allow-list，未绑定玩家可以连接，但：
 * - 权限降为访客
 * - 关闭移动输入，并在偏离锚点时拉回
 * - 取消破坏、放置与交互
 * - 聊天栏定期提示去绑定
 * 绑定成功后恢复移动，操作员还原 operator，其余设为 member。
 */

import {
  InputPermissionCategory,
  Player,
  system,
  world,
  type PlayerBreakBlockBeforeEvent,
  type PlayerInteractWithBlockBeforeEvent,
  type PlayerInteractWithEntityBeforeEvent,
  type ItemUseBeforeEvent,
  type PlayerPlaceBlockBeforeEvent,
} from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { HttpDB, Msg } from "@sfmc-bds/sdk/sapi/runtime";
import {
  BIND_GATE_PROMPT,
  BIND_GATE_UNVERIFIED_PROMPT,
  VANILLA_ALLOWLIST_OFF_COMMANDS,
  VISITOR_PERMISSION_LEVEL,
  heldRoleFromLevel,
  movedTooFar,
  permissionCommand,
  shouldPrompt,
  type HeldRole,
} from "./play-gate-policy.js";

/** 绑定状态轮询间隔（tick）。20 tick ≈ 1 秒。 */
const REFRESH_TICKS = 20 * 5;

/** 拉回走位的间隔。比状态查询更密，避免未绑定玩家走出锚点。 */
const CLAMP_TICKS = 5;

type Anchor = { x: number; y: number; z: number };

/** 当前被门禁锁住的玩家 id。 */
const locked = new Set<string>();
/** 本局已确认绑定的玩家。重生时不再先锁一下，离线或解绑后清掉。 */
const knownBound = new Set<string>();
/** 锁定前的可玩权限，解锁时用。 */
const heldRoles = new Map<string, HeldRole>();
/** 锁定时的站立点。 */
const anchors = new Map<string, Anchor>();
/** 上次聊天提示时间。 */
const lastPromptAt = new Map<string, number>();
/** 上次尝试设置访客权限的时间，失败时不要每轮都刷命令回显。 */
const lastVisitorAttemptAt = new Map<string, number>();

const runIds: number[] = [];
let onSpawn: ((ev: { player?: Player }) => void) | null = null;
let onLeave: ((ev: { playerId?: string }) => void) | null = null;
let onBreak: ((ev: PlayerBreakBlockBeforeEvent) => void) | null = null;
let onPlace: ((ev: PlayerPlaceBlockBeforeEvent) => void) | null = null;
let onInteractBlock: ((ev: PlayerInteractWithBlockBeforeEvent) => void) | null = null;
let onInteractEntity: ((ev: PlayerInteractWithEntityBeforeEvent) => void) | null = null;
let onItemUse: ((ev: ItemUseBeforeEvent) => void) | null = null;
let refreshBusy = false;

function playerAlive(player: Player): boolean {
  try {
    return player.isValid;
  } catch {
    return false;
  }
}

/** 用主世界上下文执行命令，避免访客自己没有权限改 permission。 */
function runServerCommand(command: string): void {
  try {
    world.getDimension("overworld").runCommand(command);
  } catch {
    /* 部分版本没有对应命令时，移动锁定和交互取消仍然生效 */
  }
}

/** 关闭原版准入白名单，让未绑定玩家能够连上服务器。 */
export function disableVanillaAllowList(): void {
  for (const command of VANILLA_ALLOWLIST_OFF_COMMANDS) {
    runServerCommand(command);
  }
}

function rememberRole(player: Player): void {
  if (heldRoles.has(player.id)) return;
  let level: number | undefined;
  try {
    level = player.playerPermissionLevel;
  } catch {
    level = undefined;
  }
  heldRoles.set(player.id, heldRoleFromLevel(level));
}

function setMovementEnabled(player: Player, enabled: boolean): void {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, enabled);
  } catch {
    /* 输入权限不可用时依赖锚点拉回 */
  }
}

function captureAnchor(player: Player): void {
  try {
    const loc = player.location;
    anchors.set(player.id, { x: loc.x, y: loc.y, z: loc.z });
  } catch {
    /* 实体已失效 */
  }
}

/**
 * 把玩家收成访客并禁止移动。
 * resetAnchor 用于刚进服或重生：锚点改到当前位置，而不是死前的坐标。
 */
export function applyVisitorLock(player: Player, resetAnchor: boolean): void {
  if (!playerAlive(player)) return;
  rememberRole(player);
  const entering = !locked.has(player.id);
  locked.add(player.id);
  if (entering || resetAnchor) captureAnchor(player);
  setMovementEnabled(player, false);
  ensureVisitor(player, Date.now(), entering);
}

function ensureVisitor(player: Player, now: number, force: boolean): void {
  let level = VISITOR_PERMISSION_LEVEL;
  try {
    level = player.playerPermissionLevel;
  } catch {
    return;
  }
  if (level === VISITOR_PERMISSION_LEVEL) return;
  const prev = lastVisitorAttemptAt.get(player.id) ?? 0;
  if (!force && now - prev < 30_000) return;
  lastVisitorAttemptAt.set(player.id, now);
  runServerCommand(permissionCommand(player.name, "visitor"));
}

/** 绑定生效后解除门禁。未锁定的玩家不重复改权限。 */
export function releasePlayGate(player: Player): boolean {
  knownBound.add(player.id);
  if (!locked.has(player.id)) return false;
  const role = heldRoles.get(player.id) ?? "member";
  locked.delete(player.id);
  heldRoles.delete(player.id);
  anchors.delete(player.id);
  lastPromptAt.delete(player.id);
  lastVisitorAttemptAt.delete(player.id);
  if (!playerAlive(player)) return true;
  setMovementEnabled(player, true);
  runServerCommand(permissionCommand(player.name, role));
  return true;
}

/** 绑定确认成功时调用：立刻解除锁定，不必等下一轮查询。 */
export function markBoundAndRelease(player: Player): void {
  releasePlayGate(player);
}

function forgetPlayer(playerId: string): void {
  knownBound.delete(playerId);
  locked.delete(playerId);
  heldRoles.delete(playerId);
  anchors.delete(playerId);
  lastPromptAt.delete(playerId);
  lastVisitorAttemptAt.delete(playerId);
}

function prompt(player: Player, text: string, now: number): void {
  const last = lastPromptAt.get(player.id) ?? 0;
  if (!shouldPrompt(last, now)) return;
  lastPromptAt.set(player.id, now);
  try {
    Msg.warning(text, player as never);
  } catch {
    /* ignore */
  }
}

/** 查询该 xuid 是否已写入绑定白名单。查不到时返回 null，调用方保持锁定。 */
export async function queryBound(xuid: string): Promise<boolean | null> {
  const result = await HttpDB.typedRequest<{ success?: boolean; bound?: boolean }>(
    HttpRequestMethod.GET,
    `/api/sfmc/qq/bind/me?xuid=${encodeURIComponent(xuid)}`
  );
  if (!result.ok || result.data?.success === false) return null;
  return result.data?.bound === true;
}

async function refreshPlayer(player: Player): Promise<void> {
  if (!playerAlive(player)) return;
  let bound: boolean | null = null;
  try {
    bound = await queryBound(player.id);
  } catch {
    bound = null;
  }
  system.run(() => {
    if (!playerAlive(player)) return;
    if (bound === true) {
      releasePlayGate(player);
      return;
    }
    // 曾经确认绑定过时，短暂查询失败不收回权限；明确未绑定才重新上锁。
    if (bound === null && knownBound.has(player.id)) return;
    knownBound.delete(player.id);
    const entering = !locked.has(player.id);
    applyVisitorLock(player, false);
    prompt(player, bound === null ? BIND_GATE_UNVERIFIED_PROMPT : BIND_GATE_PROMPT, Date.now());
    if (entering) captureAnchor(player);
  });
}

function refreshOnline(): void {
  if (refreshBusy) return;
  const players = world.getAllPlayers().filter(playerAlive);
  if (players.length === 0) return;
  refreshBusy = true;
  void Promise.all(players.map((player) => refreshPlayer(player))).finally(() => {
    refreshBusy = false;
  });
}

/** 未绑定玩家若仍能移动，拉回锁定时的位置。 */
export function clampLockedPlayers(): void {
  for (const player of world.getAllPlayers()) {
    if (!locked.has(player.id) || !playerAlive(player)) continue;
    setMovementEnabled(player, false);
    const anchor = anchors.get(player.id);
    if (!anchor) {
      captureAnchor(player);
      continue;
    }
    let loc: Anchor;
    try {
      loc = player.location;
    } catch {
      continue;
    }
    if (!movedTooFar(loc.x - anchor.x, loc.y - anchor.y, loc.z - anchor.z)) continue;
    try {
      player.teleport(anchor);
    } catch {
      /* 区块未加载时下一轮再拉 */
    }
  }
}

function cancelIfLocked(player: Player | undefined, ev: { cancel: boolean }): void {
  try {
    if (player && locked.has(player.id)) ev.cancel = true;
  } catch {
    /* 受限执行模式下读不到玩家时不拦截，访客权限仍会挡住多数交互 */
  }
}

/** 启动门禁：关原版白名单、进服即锁、周期复核绑定。cleanup 时调用 stopPlayGate。 */
export function startPlayGate(): void {
  stopPlayGate();
  disableVanillaAllowList();
  runIds.push(system.runTimeout(() => disableVanillaAllowList(), 20));
  runIds.push(system.runTimeout(() => disableVanillaAllowList(), 100));

  onSpawn = (ev) => {
    const player = ev.player;
    if (!player) return;
    // 已确认绑定的玩家重生时不先锁住；首次进服仍先锁，等查询结果再放开。
    if (!knownBound.has(player.id)) applyVisitorLock(player, true);
    void refreshPlayer(player);
  };
  onLeave = (ev) => {
    const id = String(ev.playerId ?? "");
    if (id) forgetPlayer(id);
  };
  onBreak = (ev) => cancelIfLocked(ev.player, ev);
  onPlace = (ev) => cancelIfLocked(ev.player, ev);
  onInteractBlock = (ev) => cancelIfLocked(ev.player, ev);
  onInteractEntity = (ev) => cancelIfLocked(ev.player, ev);
  onItemUse = (ev) => cancelIfLocked(ev.source, ev);

  world.afterEvents.playerSpawn.subscribe(onSpawn as never);
  world.afterEvents.playerLeave.subscribe(onLeave as never);
  world.beforeEvents.playerBreakBlock.subscribe(onBreak as never);
  world.beforeEvents.playerPlaceBlock.subscribe(onPlace as never);
  world.beforeEvents.playerInteractWithBlock.subscribe(onInteractBlock as never);
  world.beforeEvents.playerInteractWithEntity.subscribe(onInteractEntity as never);
  world.beforeEvents.itemUse.subscribe(onItemUse as never);

  runIds.push(system.runInterval(() => clampLockedPlayers(), CLAMP_TICKS));
  runIds.push(
    system.runInterval(() => {
      refreshOnline();
    }, REFRESH_TICKS)
  );
  system.run(() => refreshOnline());
}

/** 卸模块时清掉定时器、订阅和内存中的锁定状态。 */
export function stopPlayGate(): void {
  for (const id of runIds) {
    try {
      system.clearRun(id);
    } catch {
      /* ignore */
    }
  }
  runIds.length = 0;
  const unsub = (signal: { unsubscribe: (cb: unknown) => void } | undefined, cb: unknown) => {
    if (!signal || !cb) return;
    try {
      signal.unsubscribe(cb);
    } catch {
      /* ignore */
    }
  };
  unsub(world.afterEvents.playerSpawn as never, onSpawn);
  unsub(world.afterEvents.playerLeave as never, onLeave);
  unsub(world.beforeEvents.playerBreakBlock as never, onBreak);
  unsub(world.beforeEvents.playerPlaceBlock as never, onPlace);
  unsub(world.beforeEvents.playerInteractWithBlock as never, onInteractBlock);
  unsub(world.beforeEvents.playerInteractWithEntity as never, onInteractEntity);
  unsub(world.beforeEvents.itemUse as never, onItemUse);
  onSpawn = null;
  onLeave = null;
  onBreak = null;
  onPlace = null;
  onInteractBlock = null;
  onInteractEntity = null;
  onItemUse = null;
  knownBound.clear();
  locked.clear();
  heldRoles.clear();
  anchors.clear();
  lastPromptAt.clear();
  lastVisitorAttemptAt.clear();
  refreshBusy = false;
}

/** 单测与绑定成功路径可读：该玩家当前是否处于门禁锁定。 */
export function isPlayGateLocked(playerId: string): boolean {
  return locked.has(playerId);
}
