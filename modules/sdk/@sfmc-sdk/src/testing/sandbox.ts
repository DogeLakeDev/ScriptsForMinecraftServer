/**
 * createSandbox — 对齐 BDS 宿主分相：ConfigManager + ModuleRegistry + 假 worldLoad。
 */

import type { ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import { ConfigManager, ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Command, Permission } from "@sfmc-bds/sdk/sapi/runtime";
import {
  disposeEngine,
  resetEngine,
  createEnginePlayer,
  getSystem,
  type FakePlayer,
  type FakePlayerInit,
  type FakeSystem,
  type FakeWorld,
  type FakeUiHost,
} from "./engine/runtime.js";
import { createFakeDb, type FakeDb, type FakeDbStub } from "./fake-db.js";
import { runCleanup } from "./lifecycle.js";
import {
  createMemoryDataAdapter,
  type MemoryConfigsAll,
  type MemoryDataAdapter,
} from "./host/memory-data-adapter.js";
import { SERVER_L0_META, SERVER_UI_L0_META } from "./engine/generated/l0-meta.js";
import { createObjectRegistry, type SandboxObjects } from "./objects.js";
import { createEventsDrive, type SandboxEvents } from "./events-drive.js";
import { loadModuleDescriptor } from "./load-module.js";
import {
  applyFixtureIntent,
  configsFromFixtureIntent,
  type SandboxFixtureIntent,
} from "./fixture.js";
import { toDamageSource } from "./engine/overrides/damage-source.js";
import type { FakeBlock, FakeBlockPermutation } from "./engine/overrides/dimension.js";

export type { MemoryConfigsAll, MemoryDataAdapter };
export type { SandboxFixtureIntent };

/** 宿主分相进度（playground-host / UI 勾选）。 */
export type SandboxProgressStep = {
  id: number;
  layer: "native" | "sfmc" | "ready";
  label: string;
  status: "running" | "done" | "error";
};

export interface CreateSandboxOpts {
  /** 模块描述符；缺省则只起假引擎、不 boot。 */
  module?: ModuleDescriptor;
  /**
   * 模块根目录：装载 sapi/src/index.ts（或 .js/.mjs），取 DESCRIPTOR 后 boot。
   * 与 module 同时给出时以 moduleRoot 为准。
   */
  moduleRoot?: string;
  /** 默认 true：走 Registry boot + 假 worldLoad。 */
  boot?: boolean;
  /** 覆盖内存 configs/all（缺省为当前 module 启用）。 */
  configs?: MemoryConfigsAll;
  /** 模块是否启用；默认 true（写入 configs.modules）。 */
  enabled?: boolean;
  /**
   * 夹具意图：合并进 configs 后 boot；与 configs 同时给出时先 configs 再叠 intent。
   * 运行中改夹具请用 sandbox.applyFixture / playground-host fixture.apply。
   */
  fixture?: SandboxFixtureIntent;
  db?: FakeDbStub;
  /** 分相进度回调（原生层 / SFMC 层分标）。 */
  onProgress?: (step: SandboxProgressStep) => void;
}

/** 沙箱侧事件触发（非 MC 公开 API）。 */
export type SandboxEmit = {
  playerJoin(player: FakePlayer): void;
  playerSpawn(player: FakePlayer, opts?: { initialSpawn?: boolean }): void;
  /** 默认走 beforeEvents.chatSend；`after: true` 时再发 afterEvents.chatSend。 */
  chatSend(player: FakePlayer, message: string, opts?: { after?: boolean }): void;
  scriptEvent(id: string, sourceEntity?: unknown): void;
  /** 从世界移除玩家并触发 playerLeave（before + after）。 */
  playerLeave(player: FakePlayer): void;
  /** itemUse：默认 after；`before: true` 时走 beforeEvents（可带 cancel）。 */
  itemUse(
    player: FakePlayer,
    itemStack?: unknown,
    opts?: { before?: boolean; itemStack?: unknown }
  ): void;
  /** playerBreakBlock：默认 after；payload 对齐 Event 属性袋（可缺省）。 */
  playerBreakBlock(
    player: FakePlayer,
    opts?: {
      before?: boolean;
      block?: unknown;
      brokenBlockPermutation?: unknown;
      itemStackBeforeBreak?: unknown;
      itemStackAfterBreak?: unknown;
    }
  ): void;
  /**
   * playerPlaceBlock：默认 before→（未 cancel 则落块）→after；
   * `before: true` 仅 before（area/creative cancel 主路径）。
   */
  playerPlaceBlock(
    player: FakePlayer,
    opts?: {
      before?: boolean;
      block?: FakeBlock;
      permutationToPlace?: FakeBlockPermutation;
      face?: string;
      faceLocation?: { x: number; y: number; z: number };
    }
  ): void;
  /** playerInteractWithBlock：默认 after；`before: true` 可带 cancel。 */
  playerInteractWithBlock(
    player: FakePlayer,
    opts?: {
      before?: boolean;
      block?: FakeBlock;
      blockFace?: string;
      faceLocation?: { x: number; y: number; z: number };
      itemStack?: unknown;
      beforeItemStack?: unknown;
      isFirstEvent?: boolean;
    }
  ): void;
  entityHitEntity(damagingEntity: unknown, hitEntity: unknown): void;
};

export type Sandbox = {
  world: FakeWorld;
  system: FakeSystem;
  ui: FakeUiHost;
  db: FakeDb;
  /** 当前 boot 的模块；engine-only 时为 null。 */
  module: { id: string; root?: string } | null;
  supported: {
    events: string[];
    system: string[];
    ui: string[];
    /** L0 生成元数据（来自 gen-mc-fake）。 */
    l0: {
      server: typeof SERVER_L0_META;
      serverUi: typeof SERVER_UI_L0_META;
    };
  };
  addPlayer(init: FakePlayerInit): FakePlayer;
  /** L2：按真实事件名触发订阅（模块 registerEvents 后可断言）。 */
  emit: SandboxEmit;
  tick(n?: number): void;
  flush(): void;
  /** 触发 ! 命令（走 Command.trigger；需先 boot 注册）。手点主路径请用 emit.chatSend。 */
  triggerCommand(name: string, player?: FakePlayer): Promise<void>;
  /** 1:1 构造 / 调用 */
  objects: SandboxObjects;
  /** 1:1 事件 emit */
  events: SandboxEvents;
  /** 内存 configs 适配器（夹具读写）。 */
  configAdapter: MemoryDataAdapter;
  /** 运行中应用夹具意图并刷新 ConfigManager。 */
  applyFixture(intent: SandboxFixtureIntent): Promise<SandboxFixtureIntent>;
  /** 清空假 DB 调用日志。 */
  clearDb(): void;
  dispose(): Promise<void>;
};

const SUPPORTED = {
  events: [
    "world.afterEvents.worldLoad",
    "world.afterEvents.playerSpawn",
    "world.afterEvents.playerJoin",
    "world.afterEvents.chatSend",
    "world.beforeEvents.chatSend",
    "system.afterEvents.scriptEventReceive",
  ],
  system: ["run", "runTimeout", "runInterval", "clearRun", "waitTicks", "tick"],
  ui: [
    "ActionFormData",
    "MessageFormData",
    "ModalFormData",
    "CustomForm",
    "MessageBox",
    "uiManager",
    "queueResponse",
  ],
  l0: {
    server: SERVER_L0_META,
    serverUi: SERVER_UI_L0_META,
  },
};

function defaultConfigsFor(module: ModuleDescriptor | undefined, enabled: boolean): MemoryConfigsAll {
  if (!module) {
    return { modules: [], settings: {}, permissions: [], module_tokens: {} };
  }
  const id = module.id;
  const configKey = id.includes("-") ? id.slice(id.indexOf("-") + 1).replace(/-/g, "_") : id;
  return {
    modules: [
      {
        id,
        configKey,
        enabled,
        installed: true,
      },
    ],
    module_tokens: { [id]: `test-token-${id}` },
    settings: {},
    permissions: [],
  };
}

function progress(
  onProgress: CreateSandboxOpts["onProgress"],
  step: Omit<SandboxProgressStep, "status">,
  status: SandboxProgressStep["status"]
): void {
  onProgress?.({ ...step, status });
}

/** 聊天 `!` / `！` → Command.trigger（对齐 BDS 宿主拦截）。 */
function installChatCommandBridge(world: FakeWorld): void {
  world.beforeEvents.chatSend!.subscribe((ev) => {
    const bag = ev as { sender?: FakePlayer; message?: string; cancel?: boolean };
    const raw = String(bag?.message ?? "");
    if (!raw.startsWith("!") && !raw.startsWith("！")) return;
    const name = raw.slice(1).trim().split(/\s+/)[0];
    if (!name) return;
    if (!bag.sender) return;
    bag.cancel = true;
    Command.trigger(bag.sender as never, name);
  });
}

export async function createSandbox(opts: CreateSandboxOpts = {}): Promise<Sandbox> {
  const onProgress = opts.onProgress;
  const report = (id: number, layer: SandboxProgressStep["layer"], label: string) => ({
    id,
    layer,
    label,
  });

  progress(onProgress, report(0, "native", "装载脚本入口（early）"), "running");
  ConfigManager.resetForTesting();
  ModuleRegistry.resetForTesting();

  progress(onProgress, report(1, "native", "加载 System"), "running");
  const eng = resetEngine();
  const db = createFakeDb(opts.db);
  progress(onProgress, report(1, "native", "加载 System"), "done");

  progress(onProgress, report(2, "native", "加载 World 壳"), "running");
  progress(onProgress, report(2, "native", "加载 World 壳"), "done");

  progress(onProgress, report(3, "native", "绑定 @minecraft 表面"), "running");
  globalThis.__sfmcBdsSystem = {
    clearRun(id: number) {
      getSystem().clearRun(id);
    },
    runInterval(cb: () => void, ticks?: number) {
      return getSystem().runInterval(cb, ticks);
    },
    run(cb: () => void, ticks?: number) {
      return getSystem().run(cb, ticks);
    },
  };
  installChatCommandBridge(eng.world);
  progress(onProgress, report(3, "native", "绑定 @minecraft 表面"), "done");
  progress(onProgress, report(0, "native", "装载脚本入口（early）"), "done");

  const enabled =
    opts.fixture?.enabled !== undefined ? opts.fixture.enabled !== false : opts.enabled !== false;

  // 先解析模块描述符（moduleRoot 优先），再写 configs
  let moduleRef: ModuleDescriptor | undefined = opts.module;
  const moduleRoot = opts.moduleRoot?.trim() || undefined;
  if (moduleRoot) {
    progress(onProgress, report(0, "native", "装载脚本入口（early）"), "running");
    moduleRef = await loadModuleDescriptor(moduleRoot);
    progress(onProgress, report(0, "native", "装载脚本入口（early）"), "done");
  }

  const baseConfigs = opts.configs ?? defaultConfigsFor(moduleRef, enabled);
  const configs = configsFromFixtureIntent(baseConfigs, opts.fixture, moduleRef?.id);

  progress(onProgress, report(4, "native", "system.beforeEvents.startup"), "running");
  progress(onProgress, report(5, "sfmc", "ConfigManager.init"), "running");
  const configAdapter = createMemoryDataAdapter(configs);
  ConfigManager.bindDataAdapter(configAdapter);
  await ConfigManager.init();
  progress(onProgress, report(5, "sfmc", "ConfigManager.init"), "done");
  progress(onProgress, report(4, "native", "system.beforeEvents.startup"), "done");

  if (moduleRef && opts.boot !== false) {
    // 入口副作用可能已 register；按 id 去重
    if (!ModuleRegistry.get(moduleRef.id)) {
      ModuleRegistry.register(moduleRef);
    }
    progress(onProgress, report(6, "sfmc", "ModuleRegistry.bootAll"), "running");
    ModuleRegistry.bootAll();
    progress(onProgress, report(6, "sfmc", "ModuleRegistry.bootAll"), "done");

    progress(onProgress, report(7, "sfmc", "snapshotEnabled"), "running");
    ModuleRegistry.snapshotEnabled();
    progress(onProgress, report(7, "sfmc", "snapshotEnabled"), "done");

    progress(onProgress, report(8, "native", "（等待世界就绪）"), "running");
    progress(onProgress, report(8, "native", "（等待世界就绪）"), "done");

    progress(onProgress, report(9, "native", "Dimension 默认可查询"), "running");
    progress(onProgress, report(9, "native", "Dimension 默认可查询"), "done");

    progress(onProgress, report(10, "native", "world.afterEvents.worldLoad"), "running");
    eng.world.afterEvents.worldLoad!.emit({});
    progress(onProgress, report(10, "native", "world.afterEvents.worldLoad"), "done");

    progress(onProgress, report(11, "sfmc", "bootAfterWorldLoad"), "running");
    ModuleRegistry.bootAfterWorldLoad();
    progress(onProgress, report(11, "sfmc", "bootAfterWorldLoad"), "done");
  }

  progress(onProgress, report(12, "ready", "就绪"), "done");

  let disposed = false;

  const addPlayer = (init: Parameters<Sandbox["addPlayer"]>[0]) => {
    const userHook = init.onGameModeChange;
    const userHealth = init.onHealthChange;
    const userHurt = init.onHurt;
    const userDie = init.onDie;
    const p = createEnginePlayer({
      ...init,
      onGameModeChange: (player, from, to) => {
        userHook?.(player, from, to);
        eng.world.beforeEvents.playerGameModeChange!.emit({
          player,
          fromGameMode: from,
          toGameMode: to,
          cancel: false,
        });
        eng.world.afterEvents.playerGameModeChange!.emit({
          player,
          fromGameMode: from,
          toGameMode: to,
        });
      },
      onHealthChange: (player, oldValue, newValue) => {
        userHealth?.(player, oldValue, newValue);
        eng.world.afterEvents.entityHealthChanged!.emit({
          entity: player,
          oldValue,
          newValue,
        });
      },
      onHurt: (player, damage, options) => {
        userHurt?.(player, damage, options);
        eng.world.afterEvents.entityHurt!.emit({
          hurtEntity: player,
          damage,
          damageSource: toDamageSource(options),
        });
      },
      onDie: (player, options) => {
        userDie?.(player, options);
        eng.world.afterEvents.entityDie!.emit({
          deadEntity: player,
          damageSource: toDamageSource(options),
        });
      },
    });
    const dim = eng.world.getDimension(p.dimension.id);
    p.dimension = dim;
    eng.world.addPlayer(p);
    return p;
  };

  const objects = createObjectRegistry({
    world: eng.world,
    system: eng.system,
    addPlayer,
  });
  const events = createEventsDrive({ world: eng.world, system: eng.system, objects });

  const sb: Sandbox = {
    world: eng.world,
    system: eng.system,
    ui: eng.ui,
    db,
    configAdapter,
    module: moduleRef
      ? moduleRoot
        ? { id: moduleRef.id, root: moduleRoot }
        : { id: moduleRef.id }
      : null,
    supported: SUPPORTED,
    objects,
    events,
    addPlayer,
    emit: {
      playerJoin(player) {
        eng.world.afterEvents.playerJoin!.emit({
          playerName: player.name,
          playerId: player.id,
        });
      },
      playerSpawn(player, spawnOpts) {
        eng.world.afterEvents.playerSpawn!.emit({
          player,
          initialSpawn: spawnOpts?.initialSpawn ?? true,
        });
      },
      chatSend(player, message, chatOpts) {
        eng.world.beforeEvents.chatSend!.emit({
          sender: player,
          message,
          cancel: false,
        });
        if (chatOpts?.after) {
          eng.world.afterEvents.chatSend!.emit({ sender: player, message });
        }
      },
      scriptEvent(id, sourceEntity) {
        eng.system.afterEvents.scriptEventReceive!.emit({ id, sourceEntity });
      },
      playerLeave(player) {
        eng.world.removePlayer(player.id);
      },
      itemUse(player, itemStack, opts) {
        const stack = opts?.itemStack ?? itemStack ?? undefined;
        const payload = { source: player, itemStack: stack, cancel: false };
        if (opts?.before) {
          eng.world.beforeEvents.itemUse!.emit(payload);
        } else {
          eng.world.afterEvents.itemUse!.emit(payload);
        }
      },
      playerBreakBlock(player, opts) {
        const payload = {
          player,
          block: opts?.block,
          brokenBlockPermutation: opts?.brokenBlockPermutation,
          itemStackBeforeBreak: opts?.itemStackBeforeBreak,
          itemStackAfterBreak: opts?.itemStackAfterBreak,
          cancel: false,
        };
        if (opts?.before) {
          eng.world.beforeEvents.playerBreakBlock!.emit(payload);
        } else {
          eng.world.afterEvents.playerBreakBlock!.emit(payload);
        }
      },
      playerPlaceBlock(player, opts) {
        const block =
          opts?.block ??
          player.dimension.getBlock(player.location);
        const permutationToPlace = opts?.permutationToPlace;
        const beforePayload = {
          player,
          block,
          permutationToPlace,
          face: opts?.face ?? "Up",
          faceLocation: opts?.faceLocation ?? { x: 0.5, y: 1, z: 0.5 },
          cancel: false,
        };
        eng.world.beforeEvents.playerPlaceBlock!.emit(beforePayload);
        if (opts?.before) return;
        if (beforePayload.cancel) return;
        if (permutationToPlace) {
          block.setPermutation(permutationToPlace);
        }
        eng.world.afterEvents.playerPlaceBlock!.emit({
          player,
          block,
        });
      },
      playerInteractWithBlock(player, opts) {
        const block = opts?.block ?? player.dimension.getBlock(player.location);
        const payload = {
          player,
          block,
          blockFace: opts?.blockFace ?? "Up",
          faceLocation: opts?.faceLocation ?? { x: 0.5, y: 1, z: 0.5 },
          itemStack: opts?.itemStack,
          beforeItemStack: opts?.beforeItemStack ?? opts?.itemStack,
          isFirstEvent: opts?.isFirstEvent ?? true,
          cancel: false,
        };
        if (opts?.before) {
          eng.world.beforeEvents.playerInteractWithBlock!.emit(payload);
        } else {
          eng.world.afterEvents.playerInteractWithBlock!.emit(payload);
        }
      },
      entityHitEntity(damagingEntity, hitEntity) {
        eng.world.afterEvents.entityHitEntity!.emit({ damagingEntity, hitEntity });
      },
    },
    tick(n = 1) {
      eng.system.tick(n);
    },
    flush() {
      eng.system.flush();
    },
    async triggerCommand(name, player) {
      Command.trigger(player as never, name);
      eng.system.flush();
      await Promise.resolve();
      eng.system.flush();
      await Promise.resolve();
      eng.system.flush();
    },
    async applyFixture(intent) {
      return applyFixtureIntent(
        {
          adapter: configAdapter,
          db,
          moduleId: moduleRef?.id ?? null,
          getPlayers: () => eng.world.getAllPlayers(),
        },
        intent
      );
    },
    clearDb() {
      db.reset();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      if (moduleRef) {
        try {
          ModuleRegistry.cleanupModule(moduleRef.id);
        } catch {
          await runCleanup(moduleRef);
        }
        if (moduleRef.id) Command.unregisterByModule(moduleRef.id);
        for (const n of Command.names()) {
          Command.unregister(n);
        }
        Permission.clearRegistry();
      }
      ModuleRegistry.resetForTesting();
      ConfigManager.resetForTesting();
      db.reset();
      disposeEngine();
      globalThis.__sfmcBdsSystem = undefined;
    },
  };

  return sb;
}

export type { FormResponse } from "./engine/overrides/ui-host.js";
