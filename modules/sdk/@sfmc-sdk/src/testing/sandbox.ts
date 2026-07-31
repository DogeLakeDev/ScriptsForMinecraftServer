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
} from "./host/memory-data-adapter.js";
import { SERVER_L0_META, SERVER_UI_L0_META } from "./engine/generated/l0-meta.js";
import { createObjectRegistry, type SandboxObjects } from "./objects.js";
import { createEventsDrive, type SandboxEvents } from "./events-drive.js";

export type { MemoryConfigsAll };

export interface CreateSandboxOpts {
  /** 模块描述符；缺省则只起假引擎、不 boot。 */
  module?: ModuleDescriptor;
  /** 默认 true：走 Registry boot + 假 worldLoad。 */
  boot?: boolean;
  /** 覆盖内存 configs/all（缺省为当前 module 启用）。 */
  configs?: MemoryConfigsAll;
  /** 模块是否启用；默认 true（写入 configs.modules）。 */
  enabled?: boolean;
  db?: FakeDbStub;
}

/** 沙箱侧事件触发（非 MC 公开 API）。 */
export type SandboxEmit = {
  playerJoin(player: FakePlayer): void;
  playerSpawn(player: FakePlayer, opts?: { initialSpawn?: boolean }): void;
  /** 默认走 beforeEvents.chatSend；`after: true` 时再发 afterEvents.chatSend。 */
  chatSend(player: FakePlayer, message: string, opts?: { after?: boolean }): void;
  scriptEvent(id: string, sourceEntity?: unknown): void;
};

export type Sandbox = {
  world: FakeWorld;
  system: FakeSystem;
  ui: FakeUiHost;
  db: FakeDb;
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
  /** 触发 ! 命令（走 Command.trigger；需先 boot 注册）。 */
  triggerCommand(name: string, player?: FakePlayer): Promise<void>;
  /** 1:1 构造 / 调用 */
  objects: SandboxObjects;
  /** 1:1 事件 emit */
  events: SandboxEvents;
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

export async function createSandbox(opts: CreateSandboxOpts = {}): Promise<Sandbox> {
  ConfigManager.resetForTesting();
  ModuleRegistry.resetForTesting();

  const eng = resetEngine();
  const db = createFakeDb(opts.db);

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

  const enabled = opts.enabled !== false;
  const configs = opts.configs ?? defaultConfigsFor(opts.module, enabled);
  ConfigManager.bindDataAdapter(createMemoryDataAdapter(configs));
  await ConfigManager.init();

  if (opts.module && opts.boot !== false) {
    ModuleRegistry.register(opts.module);
    ModuleRegistry.bootAll();
    ModuleRegistry.snapshotEnabled();
    eng.world.afterEvents.worldLoad!.emit({});
    ModuleRegistry.bootAfterWorldLoad();
  }

  let disposed = false;
  const moduleRef = opts.module;

  const addPlayer = (init: Parameters<Sandbox["addPlayer"]>[0]) => {
    const p = createEnginePlayer(init);
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
      playerSpawn(player, opts) {
        eng.world.afterEvents.playerSpawn!.emit({
          player,
          initialSpawn: opts?.initialSpawn ?? true,
        });
      },
      chatSend(player, message, opts) {
        eng.world.beforeEvents.chatSend!.emit({
          sender: player,
          message,
          cancel: false,
        });
        if (opts?.after) {
          eng.world.afterEvents.chatSend!.emit({ sender: player, message });
        }
      },
      scriptEvent(id, sourceEntity) {
        eng.system.afterEvents.scriptEventReceive!.emit({ id, sourceEntity });
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

export type { FormResponse } from "./engine/ui-host.js";
