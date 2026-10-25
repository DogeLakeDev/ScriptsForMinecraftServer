/**
 * scoreboard-sync.ts — 把世界计分板同步到数据服务
 *
 * 使用场景：平台宿主在世界加载后启动（module-loader/install.ts），供桌面端 / 小程序「计分板」页
 * 经 CLI 的 scoreboard.read 查看。规则与数据服务的 domain/scoreboard.ts 配套：
 *   - 每 REPORT_TICKS 上报一次；数据服务的响应告知是否有人在看（watching）；
 *   - 无人在看时只发空闲探询，不遍历计分板；
 *   - 有人在看时生成快照并计算哈希，内容未变只发哈希，变化或数据服务要求时发完整快照；
 *   - 刚得知有人在看时立即补一次上报，缩短首次打开页面的等待。
 * 离线玩家的计分板身份拿不到玩家名，因此把在线玩家「身份 ID → 名称」缓存到世界动态属性，离线后仍能显示。
 */
import { DisplaySlotId, ObjectiveSortOrder, ScoreboardIdentityType, system, world, type ScoreboardIdentity } from "@minecraft/server";
import { HttpDB, SafeHttpMethod } from "./httpdb.js";

/** 上报间隔（tick），约 2 秒 */
const REPORT_TICKS = 40;
/** 单次快照最多包含的分数条目；超过时截断并标记 truncated，避免一次遍历占用过多 tick 时间 */
const MAX_SCORES = 50_000;
/** 离线玩家名称缓存的动态属性前缀，后接计分板身份 ID */
const NAME_KEY_PREFIX = "sfmc:scoreboard_name:";

/** 上报的参与者（与数据服务 ScoreboardReportParticipant 一致） */
interface ParticipantWire {
  id: number;
  name: string;
  type: "player" | "fakePlayer" | "entity";
  online: boolean;
}

/** 快照正文（不含哈希与时间） */
interface SnapshotBody {
  participants: ParticipantWire[];
  objectives: Array<{ id: string; displayName: string; scores: Array<[number, number]> }>;
  displaySlots: Array<{ slot: "sidebar" | "list" | "belowName"; objectiveId: string; sortOrder: "ascending" | "descending" }>;
  truncated: boolean;
}

/** 显示位：游戏枚举 → 协议名称。按需求值，模块加载时不访问原生枚举（测试替身可能未提供） */
const displaySlotIds = (): Array<[DisplaySlotId, SnapshotBody["displaySlots"][number]["slot"]]> => [
  [DisplaySlotId.Sidebar, "sidebar"],
  [DisplaySlotId.List, "list"],
  [DisplaySlotId.BelowName, "belowName"],
];

/** 32 位 FNV-1a 哈希，只用于判断快照内容是否变化 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

/** 本次运行中已写入动态属性的名称，避免每次快照都读写动态属性 */
const cachedNames = new Map<number, string>();

/** 记住在线玩家的名称；名称变化（改名）时覆盖 */
function rememberName(id: number, name: string): void {
  if (cachedNames.get(id) === name) return;
  cachedNames.set(id, name);
  try {
    if (world.getDynamicProperty(NAME_KEY_PREFIX + id) !== name) world.setDynamicProperty(NAME_KEY_PREFIX + id, name);
  } catch {
    /* 动态属性不可写时只保留内存缓存 */
  }
}

/** 读取离线玩家最近一次的名称；从未见过时返回 undefined */
function recalledName(id: number): string | undefined {
  const cached = cachedNames.get(id);
  if (cached !== undefined) return cached;
  try {
    const value = world.getDynamicProperty(NAME_KEY_PREFIX + id);
    if (typeof value === "string") {
      cachedNames.set(id, value);
      return value;
    }
  } catch {
    /* 读取失败按未知处理 */
  }
  return undefined;
}

/** 解析一个计分板身份；在线玩家按 scoreboardIdentity.id 预先建好索引 */
function describe(identity: ScoreboardIdentity, onlinePlayers: Map<number, string>): ParticipantWire {
  const id = identity.id;
  if (identity.type === ScoreboardIdentityType.Player) {
    const online = onlinePlayers.get(id);
    return { id, name: online ?? recalledName(id) ?? identity.displayName, type: "player", online: online !== undefined };
  }
  if (identity.type === ScoreboardIdentityType.FakePlayer) {
    return { id, name: identity.displayName, type: "fakePlayer", online: false };
  }
  // 非玩家实体：已加载时取名称标签或类型 ID；未加载时 getEntity 会抛出
  let entity: { nameTag?: string; typeId?: string } | undefined;
  try {
    entity = identity.getEntity();
  } catch {
    entity = undefined;
  }
  return { id, name: entity?.nameTag || entity?.typeId || identity.displayName, type: "entity", online: entity !== undefined };
}

/** 遍历世界计分板生成快照 */
function collectSnapshot(): SnapshotBody {
  const onlinePlayers = new Map<number, string>();
  for (const player of world.getAllPlayers()) {
    const identity = player.scoreboardIdentity;
    if (!identity) continue;
    onlinePlayers.set(identity.id, player.name);
    rememberName(identity.id, player.name);
  }
  const participants = new Map<number, ParticipantWire>();
  const objectives: SnapshotBody["objectives"] = [];
  let total = 0;
  let truncated = false;
  for (const objective of world.scoreboard.getObjectives()) {
    const scores: Array<[number, number]> = [];
    for (const info of objective.getScores()) {
      if (total >= MAX_SCORES) {
        truncated = true;
        break;
      }
      const identity = info.participant;
      if (!participants.has(identity.id)) participants.set(identity.id, describe(identity, onlinePlayers));
      scores.push([identity.id, info.score]);
      total++;
    }
    objectives.push({ id: objective.id, displayName: objective.displayName, scores });
  }
  const displaySlots: SnapshotBody["displaySlots"] = [];
  for (const [slotId, slot] of displaySlotIds()) {
    const options = world.scoreboard.getObjectiveAtDisplaySlot(slotId);
    if (!options?.objective) continue;
    displaySlots.push({
      slot,
      objectiveId: options.objective.id,
      sortOrder: options.sortOrder === ObjectiveSortOrder.Ascending ? "ascending" : "descending",
    });
  }
  return { participants: [...participants.values()], objectives, displaySlots, truncated };
}

let warnedAt = 0;
/** 上报失败每分钟最多提示一次 */
function warn(): void {
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.warn("[SFMC] 计分板同步失败，请检查数据服务连接与鉴权");
}

/** 运行状态。SDK 子路径独立打包，挂在 globalThis 上让 install 与其它门面共享同一份（同 monitoring.ts） */
const syncState = ((globalThis as unknown as { __sfmcScoreboardSync?: { stop?: () => void } }).__sfmcScoreboardSync ??= {});

/** 停止计分板同步。使用场景：宿主 dispose（未持有 start 返回值的一侧）。 */
export function stopScoreboardSync(): void {
  syncState.stop?.();
}

/**
 * 启动计分板同步，返回停止函数；已在运行时直接返回现有的停止函数。
 * 使用场景：module-loader/install.ts 的 startPlatformWorldRuntime；关服时调用返回值。
 */
export function startScoreboardSync(): () => void {
  if (syncState.stop) return syncState.stop;
  let disposed = false;
  let busy = false;
  let watching = false;
  /** 数据服务尚未持有与 lastHash 对应的完整快照 */
  let needFull = true;
  let lastHash = "";

  const report = () => {
    if (busy || disposed) return;
    let body: Record<string, unknown>;
    let pendingHash = "";
    try {
      if (!watching) {
        body = { kind: "idle" };
      } else {
        const snapshot = collectSnapshot();
        pendingHash = fnv1a(JSON.stringify(snapshot));
        body = needFull || pendingHash !== lastHash
          ? { kind: "full", hash: pendingHash, generatedAt: Date.now(), ...snapshot }
          : { kind: "same", hash: pendingHash, generatedAt: Date.now() };
      }
    } catch {
      return; // 世界关闭期间不再读取原生对象
    }
    const sentFull = body.kind === "full";
    const wasWatching = watching;
    busy = true;
    void HttpDB.typedRequest<{ watching?: boolean; needFull?: boolean }>(SafeHttpMethod.Post, "/api/sfmc/scoreboard/live", body)
      .then((result) => {
        if (disposed) return;
        if (!result.ok) {
          needFull = true;
          warn();
          return;
        }
        if (sentFull) lastHash = pendingHash;
        needFull = result.data?.needFull === true || (needFull && !sentFull);
        watching = result.data?.watching === true;
        // 刚开始有人查看：下一 tick 就生成快照，不等下一个上报周期
        if (watching && !wasWatching) system.run(report);
      })
      .catch(() => {
        needFull = true;
        if (!disposed) warn();
      })
      .finally(() => {
        busy = false;
      });
  };

  const interval = system.runInterval(report, REPORT_TICKS);
  report();
  syncState.stop = () => {
    disposed = true;
    system.clearRun(interval);
    delete syncState.stop;
  };
  return syncState.stop;
}
