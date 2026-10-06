/**
 * mock-bridge.ts — 浏览器预览用的模拟桌面桥（仅开发环境）
 *
 * 使用场景：直接用浏览器打开 Vite 开发服务器时没有 Electron 预加载脚本，
 * 这里注入一个行为接近真实实例的 window.sfmc（实时日志、分阶段后台任务、服务状态推送），
 * 供设计走查、截图与交互调试使用。入口由 import.meta.env.DEV 守卫，生产构建不会包含本文件。
 */
import type {
  ConfigDocument,
  Handshake,
  LogEntryWire,
  ManagementEvent,
  ManagementMethod,
  ModuleRow,
  OperationPhase,
  OperationRecord,
  PackRow,
  ServiceStatusRow,
} from "@sfmc-bds/management";
import type { AppearanceMode, DesktopApi, InstanceProfile } from "../../shared/api.js";

/** 单个模拟实例的可变状态（服务、任务、模块等），按实例 id 隔离 */
interface MockInstance {
  services: ServiceStatusRow[];
  tasks: OperationRecord[];
  modules: ModuleRow[];
  packs: PackRow[];
  configs: Map<string, ConfigDocument>;
  allowlist: unknown[];
  permissions: unknown[];
  sfmcPermissions: unknown[];
  logs: LogEntryWire[];
  connected: boolean;
}

/** 等待指定毫秒，用于模拟网络与进程延迟 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** 生成近似 UUID 的任务编号（满足备份编号的字符约束） */
const uuid = () => crypto.randomUUID();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const profiles: InstanceProfile[] = [
  { id: "local-main", name: "生存服主线", kind: "local", root: "D:\\SFMC\\survival", hasCredential: false },
  { id: "ssh-hd", name: "创造服华东", kind: "ssh", root: "/srv/sfmc/creative", host: "10.0.8.12", port: 22, username: "mc", os: "linux", hasCredential: true, remember: true },
];

/** db_config 的示例 Schema：与 SDK 中 schemas/db_config.schema.json 结构一致 */
const dbSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    $schema: { type: "string", description: "指向本 schema 的相对路径（IDE 用，运行时忽略）" },
    db_port: { type: "integer", minimum: 1, maximum: 65535, description: "db-server HTTP 监听端口（默认 3001）" },
    http_auth: { type: "string", description: "HTTP Bearer 鉴权令牌；空字符串表示不启用" },
    dbDir: { type: "string", description: "SQLite 数据库文件路径（相对 SFMC_ROOT 或绝对路径）" },
    modulesDir: { type: "string", description: "模块目录（相对 SFMC_ROOT），默认 modules" },
  },
};
const moduleUpdateSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean", description: "模块自动更新总开关" },
    checkOnBdsStart: { type: "boolean", description: "BDS 启动前是否检查已安装模块的新版本" },
    applyOnBdsStart: { type: "boolean", description: "检查到可升级版本时是否在启动前直接更换" },
    allowMajor: { type: "boolean", description: "是否允许主版本号升高" },
    failMode: { type: "string", enum: ["continue", "abort"], description: "单个模块升级失败后继续下一个，或停止本轮后续升级" },
    distTag: { type: "string", description: "未进索引的 npm 包所跟随的 dist-tag" },
  },
};
const serverProperties = `server-name=DogeLake 生存服
# 游戏模式：survival / creative / adventure
gamemode=survival
force-gamemode=false
difficulty=normal
allow-cheats=false
max-players=40
online-mode=true
allow-list=true
server-port=19132
server-portv6=19133
view-distance=24
tick-distance=6
player-idle-timeout=30
max-threads=8
level-name=Bedrock level
level-seed=
default-player-permission-level=member
texturepack-required=false
content-log-file-enabled=false
`;

/** 构造一份实例初始状态 */
function createInstance(variant: "local" | "ssh"): MockInstance {
  const now = Date.now();
  const doc = (key: string, text: string, format: ConfigDocument["format"], schema?: object): ConfigDocument => ({
    key, text, format, revision: `${key}-${text.length}`, affectedServices: ["db", "tunnel", "qq", "llbot", "bds"], ...(schema ? { schema } : {}),
  });
  const configs = new Map<string, ConfigDocument>([
    ["core/db_config.json", doc("core/db_config.json", JSON.stringify({ db_port: 3001, http_auth: "s3cr3t-token", dbDir: "data/sfmc_data.db", modulesDir: "modules" }, null, 2), "json", dbSchema)],
    ["core/module-update.json", doc("core/module-update.json", JSON.stringify({ enabled: true, checkOnBdsStart: true, applyOnBdsStart: false, allowMajor: false, failMode: "continue", distTag: "latest" }, null, 2), "json", moduleUpdateSchema)],
    ["core/qq_config.json", doc("core/qq_config.json", JSON.stringify({ qq_enabled: true, qq_backend: "llbot", groups: [123456789] }, null, 2), "json")],
    ["core/runtime.json", doc("core/runtime.json", JSON.stringify({ initialized_at: "2026-09-12T08:00:00.000Z" }, null, 2), "json")],
    ["core/bds_updater.json", doc("core/bds_updater.json", JSON.stringify({ bds_path: "BDS", backup_dir: "backups", channel: "stable" }, null, 2), "json")],
    ["core/log-filter.json", doc("core/log-filter.json", "{\n  \"rules\": []\n}", "json")],
    ["bds/server.properties", doc("bds/server.properties", serverProperties, "properties")],
    ["module/land/land.jsonc", doc("module/land/land.jsonc", "{\n  // 每位玩家可拥有的领地数量\n  \"maxLands\": 3,\n  \"pricePerBlock\": 2,\n  \"allowFly\": false\n}", "jsonc")],
    ["module/economy/economy.json", doc("module/economy/economy.json", JSON.stringify({ currency: "狗币", initialBalance: 500, transferFee: 0.02 }, null, 2), "json")],
  ]);
  const running = variant === "local";
  return {
    connected: false,
    services: [
      { name: "bds", title: "BDS", running, pid: running ? 18244 : 0, uptime: running ? "6h 12m" : "—", ownership: running ? "managed" : undefined },
      { name: "db", title: "DB Server", running, pid: running ? 17920 : 0, uptime: running ? "6h 12m" : "—", ownership: running ? "managed" : undefined },
      { name: "qq", title: "QQ Bridge", running, pid: running ? 20112 : 0, uptime: running ? "6h 11m" : "—", ownership: running ? "managed" : undefined },
      { name: "llbot", title: "LLBot", running: true, pid: 9932, uptime: "3d 4h", ownership: "external" },
      { name: "tunnel", title: "Tunnel", running: false, pid: 0, uptime: "—" },
    ],
    tasks: [
      task("updates.run", "succeeded", 95, ["stop-services", "backup", "execute", "verify", "restore"]),
      task("modules.install", "succeeded", 260, ["stop-services", "backup", "execute", "verify", "restore"]),
      task("config.apply", "failed", 1440, ["stop-services", "backup", "execute"], "配置不符合 Schema: /db_port must be integer"),
      task("services.restart", "succeeded", 2900, ["execute"]),
    ],
    modules: [
      { id: "land", folder: "sfmc-module-land", name: "land", version: "1.4.2", enabled: true, linked: false },
      { id: "economy", folder: "sfmc-module-economy", name: "economy", version: "2.0.1", enabled: true, linked: false },
      { id: "chat", folder: "sfmc-module-chat", name: "chat", version: "0.9.3", enabled: true, linked: false },
      { id: "afk", folder: "sfmc-module-afk", name: "afk", version: "0.3.0", enabled: false, linked: false },
      { id: "activity-log", folder: "sfmc-module-activity-log", name: "activity-log", version: "0.2.0-dev", enabled: true, linked: true },
      { id: "spawn-protect", folder: "sfmc-module-spawn-protect", name: "spawn-protect", version: "1.1.0", enabled: true, linked: false },
      { id: "online-time", folder: "sfmc-module-online-time", name: "online-time", version: "1.0.4", enabled: true, linked: false },
    ],
    packs: [
      { id: "6b1f4a52-3c1e-4b8e-9b0b-2f3d1c9a7e01", name: "SFMC Runtime", kind: "behavior", enabled: true, version: "0.2.4" },
      { id: "c7d2a913-88f0-4f7e-a1b5-0e6a4d2c3b11", name: "DogeLake 资源", kind: "resource", enabled: true, version: "1.3.0" },
      { id: "0aa3e6f1-5d7c-4a8b-b2c9-7f1e3d5a9c22", name: "Farmer's Delight BE", kind: "behavior", enabled: true, version: "1.2.7" },
      { id: "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c33", name: "Farmer's Delight BE 资源", kind: "resource", enabled: true, version: "1.2.7" },
      { id: "4f3e2d1c-0b9a-4876-9543-210fedcba944", name: "Touhou Little Maid", kind: "behavior", enabled: false, version: "0.8.1" },
    ],
    configs,
    allowlist: [{ name: "Steve", ignoresPlayerLimit: false }, { name: "Alex", ignoresPlayerLimit: true }, { name: "Shiroha7z", ignoresPlayerLimit: true }],
    permissions: [{ permission: "operator", xuid: "2535412345678901" }],
    sfmcPermissions: [{ player_name: "Shiroha7z", level: 3 }, { player_name: "Alex", level: 2 }, { player_name: "Steve", level: 1 }],
    logs: Array.from({ length: 260 }, (_, index) => randomLog(now - (260 - index) * 9000)),
  };
}

/** 生成一条已完成或失败的历史任务 */
function task(kind: string, status: OperationRecord["status"], ago: number, names: string[], error?: string): OperationRecord {
  const phases: OperationPhase[] = names.map((name, index) => ({
    name,
    status: status === "failed" && index === names.length - 1 ? "failed" : "done",
    startedAt: minutesAgo(ago - index * 0.3),
    finishedAt: minutesAgo(ago - index * 0.3 - 0.2),
  }));
  return {
    id: uuid(), kind, title: kind, status, phases, createdAt: minutesAgo(ago + 0.2), updatedAt: minutesAgo(ago - names.length * 0.3),
    ...(error ? { error: { code: "validation", message: error } } : { result: { changed: true } }),
  };
}

const samples: [LogEntryWire["source"], LogEntryWire["level"], string][] = [
  ["bds", "info", "Player connected: Steve, xuid: 2535412345678901"],
  ["bds", "info", "Player Spawned: Steve xuid: 2535412345678901, pfid: 4ad1c0e2b7f3a915"],
  ["bds", "info", "Running AutoCompaction..."],
  ["bds", "info", "[Scripting] [land] 玩家 Alex 进入领地「樱花小镇」"],
  ["bds", "warn", "[Scripting] watchdog: slow tick 62ms in sfmc-module-land"],
  ["bds", "info", "Player disconnected: Alex, xuid: 2535498765432109"],
  ["db", "info", "GET /api/sfmc/status 200 3ms"],
  ["db", "info", "POST /api/sfmc/kv/economy.balance 200 5ms"],
  ["db", "debug", "sqlite checkpoint: 128 pages"],
  ["qq", "info", "群 123456789 Alex：今晚开团吗？"],
  ["qq", "info", "转发到游戏：[QQ] Alex：今晚开团吗？"],
  ["qq", "warn", "llbot 心跳延迟 1.8s"],
  ["system", "success", "自动备份完成：backups/2026-10-01_17-00"],
  ["bds", "error", "[Scripting] TypeError: cannot read property 'owner' of undefined\n    at onPlayerInteract (land/index.js:120:18)"],
];

/** 随机生成一条日志 */
function randomLog(time = Date.now()): LogEntryWire {
  const weighted = Math.random() < 0.94 ? samples.filter((row) => row[1] !== "error") : samples;
  const [source, level, text] = weighted[Math.floor(Math.random() * weighted.length)]!;
  return { time: new Date(time).toISOString(), source, level, text };
}

/**
 * 安装模拟桥：仅当 window.sfmc 不存在（即非 Electron 环境）时调用。
 */
export function installMockBridge() {
  const instances = new Map<string, MockInstance>([
    ["local-main", createInstance("local")],
    ["ssh-hd", createInstance("ssh")],
  ]);
  const eventListeners = new Set<(id: string, event: ManagementEvent) => void>();
  const connectionListeners = new Set<(id: string, message: string) => void>();
  const emit = (id: string, event: ManagementEvent["event"], payload: ManagementEvent["payload"]) => {
    for (const listener of eventListeners) listener(id, { instanceId: id, type: "event", event, payload });
  };
  const get = (id: string) => {
    const value = instances.get(id);
    if (!value) throw new Error("实例不存在");
    return value;
  };

  // 实时日志：已连接的实例每隔一段时间推送一条
  setInterval(() => {
    for (const [id, instance] of instances) {
      if (!instance.connected) continue;
      const entry = randomLog();
      instance.logs.push(entry);
      emit(id, "log", entry);
    }
  }, 1600);

  /** 模拟一个分阶段推进的后台任务，并在完成时执行 effect 改变实例状态 */
  const runTask = (id: string, kind: string, phases: string[], effect?: () => void, fail?: string) => {
    const instance = get(id);
    const record: OperationRecord = { id: uuid(), kind, title: kind, status: "queued", phases: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    instance.tasks.unshift(record);
    const save = () => {
      record.updatedAt = new Date().toISOString();
      emit(id, "operation", structuredClone(record));
    };
    save();
    void (async () => {
      await sleep(500);
      record.status = "running";
      save();
      for (const name of phases) {
        const previous = record.phases.at(-1);
        if (previous) { previous.status = "done"; previous.finishedAt = new Date().toISOString(); }
        record.phases.push({ name, status: "running", startedAt: new Date().toISOString() });
        save();
        await sleep(900);
      }
      const last = record.phases.at(-1);
      if (fail) {
        if (last) last.status = "failed";
        record.status = "failed";
        record.error = { code: "io", message: fail, details: { backupId: record.id } };
      } else {
        if (last) { last.status = "done"; last.finishedAt = new Date().toISOString(); }
        effect?.();
        record.status = "succeeded";
        record.result = { changed: true };
      }
      save();
    })();
    return { operationId: record.id };
  };
  const maintenance = ["stop-services", "backup", "execute", "verify", "restore"];
  const platformNotes = {
    version: "0.2.4", title: "SFMC 0.2.4", status: "available" as const,
    body: "## 新增\n- 平台更新前可查看该版本的发行日志。\n\n## 修复\n- 重连后台时恢复实时日志订阅。",
    url: "https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases/tag/%40sfmc-bds%2Fsfmc%400.2.4",
    publishedAt: "2026-10-03T03:00:00.000Z",
  };

  const handshake = (id: string): Handshake => ({
    protocolVersion: 1,
    platformVersion: id === "local-main" ? "0.2.4" : "0.2.3",
    host: id === "local-main" ? { os: "windows", arch: "x64", release: "10.0.26200" } : { os: "linux", arch: "x64", release: "6.8.0-45-generic" },
    root: profiles.find((row) => row.id === id)?.root ?? "",
    capabilities: ["services", "logs", "modules", "config", "packs", "players", "updates", "operations"],
    daemonPid: id === "local-main" ? 15532 : 2231,
    daemonStartedAt: minutesAgo(id === "local-main" ? 372 : 4380),
    initialized: true,
  });

  const request = async (id: string, method: ManagementMethod, params: Record<string, unknown> = {}): Promise<unknown> => {
    const instance = get(id);
    if (!instance.connected) throw new Error("实例尚未连接");
    await sleep(80 + Math.random() * 160);
    const setService = (name: string, running: boolean) => {
      for (const row of instance.services) {
        if (name !== "all" && row.name !== name) continue;
        if (row.ownership === "external") continue;
        Object.assign(row, running ? { running: true, pid: 10000 + Math.floor(Math.random() * 20000), uptime: "0m", ownership: "managed" } : { running: false, pid: 0, uptime: "—", ownership: undefined });
        emit(id, "serviceState", { name: row.name, running: row.running, pid: row.pid });
      }
    };
    switch (method) {
      case "services.list": return { rows: structuredClone(instance.services) };
      case "operations.list": return { operations: structuredClone(instance.tasks) };
      case "operations.get": return { operation: structuredClone(instance.tasks.find((row) => row.id === params.operationId)) };
      case "modules.list": return { modules: structuredClone(instance.modules) };
      case "config.list": return { keys: [...instance.configs.keys()] };
      case "packs.list": return { packs: structuredClone(instance.packs) };
      case "logs.tail": return { entries: instance.logs.slice(-Number(params.limit ?? 1000)) };
      case "attachment.plan":
        return id === "local-main"
          ? { currentVersion: "0.2.4", targetVersion: "0.2.4", releaseNotes: platformNotes, development: false, upgradeRequired: false, externalServices: ["llbot"], steps: ["下载固定版本的平台依赖组合", "停止受影响服务并确认进程退出", "备份配置、模块、数据库与世界", "切换平台并验证", "恢复此前运行的服务"] }
          : { currentVersion: "0.2.3", targetVersion: "0.2.4", releaseNotes: platformNotes, development: false, upgradeRequired: true, externalServices: [], steps: ["下载固定版本的平台依赖组合", "停止受影响服务并确认进程退出", "备份配置、模块、数据库与世界", "切换平台并验证", "恢复此前运行的服务"] };
      case "attachment.apply": return runTask(id, "attachment.apply", ["prepare", "verify"]);
      case "services.start": return runTask(id, method, ["execute", "verify"], () => setService(String(params.name), true));
      case "services.stop": return runTask(id, method, ["execute"], () => setService(String(params.name), false));
      case "services.restart": return runTask(id, method, ["execute", "verify"], () => { setService(String(params.name), false); setService(String(params.name), true); });
      case "services.send": {
        const entry: LogEntryWire = { time: new Date().toISOString(), source: String(params.name), level: "info", text: `> ${String(params.message)}` };
        instance.logs.push(entry); emit(id, "log", entry);
        return { delivered: true };
      }
      case "modules.search":
        return { stale: false, modules: [
          { id: "land", npm: "@sfmc-bds/module-land", version: "1.5.0", sdk: "^0.2.0" },
          { id: "economy", npm: "@sfmc-bds/module-economy", version: "2.0.1", sdk: "^0.2.0" },
          { id: "chat", npm: "@sfmc-bds/module-chat", version: "1.0.0", sdk: "^0.2.0" },
          { id: "chat-sounds", npm: "@sfmc-bds/module-chat-sounds", version: "0.1.2", sdk: "^0.2.0" },
          { id: "coop", repo: "DogeLakeDev/sfmc-module-coop", tag: "v0.4.0" },
          { id: "data-backup", npm: "@sfmc-bds/module-data-backup", version: "0.6.0", sdk: "^0.2.0" },
          { id: "fly-area", npm: "@sfmc-bds/module-fly-area", version: "0.3.1", sdk: "^0.2.0" },
          { id: "inventory-switcher", npm: "@sfmc-bds/module-inventory-switcher", version: "0.2.0", sdk: "^0.2.0" },
          { id: "monitor", npm: "@sfmc-bds/module-monitor", version: "0.5.3", sdk: "^0.2.0" },
          { id: "qa", npm: "@sfmc-bds/module-qa", version: "0.1.0", sdk: "^0.2.0" },
        ].filter((row) => row.id.includes(String(params.query ?? ""))) };
      case "modules.install": return runTask(id, method, maintenance, () => instance.modules.push({ id: String(params.id), folder: `sfmc-module-${String(params.id)}`, name: String(params.id), version: "0.1.0", enabled: true, linked: false }));
      case "modules.uninstall": return runTask(id, method, maintenance, () => { instance.modules = instance.modules.filter((row) => row.folder !== params.id); });
      case "modules.toggle": return runTask(id, method, maintenance, () => { const row = instance.modules.find((item) => item.id === params.id); if (row) row.enabled = params.enabled === true; });
      case "config.read": {
        const document = instance.configs.get(String(params.key));
        if (!document) throw new Error("配置不在允许编辑的列表中");
        return structuredClone(document);
      }
      case "config.apply": {
        const document = instance.configs.get(String(params.key));
        if (!document) throw new Error("配置不在允许编辑的列表中");
        if (document.revision !== params.revision) throw new Error("配置已变更，请重新读取");
        return runTask(id, method, ["stop-services", "backup", "execute", "apply", "verify", "restore"], () => {
          document.text = String(params.text);
          document.revision = `${document.key}-${document.text.length}-${Date.now()}`;
        });
      }
      case "packs.import": return runTask(id, method, maintenance, () => instance.packs.push({ id: uuid(), name: String(params.filename).replace(/^\d+-/, "").replace(/\.\w+$/, ""), kind: "behavior", enabled: true, version: "1.0.0" }));
      case "packs.toggle": return runTask(id, method, maintenance, () => { const row = instance.packs.find((item) => item.id === params.id); if (row) row.enabled = params.enabled === true; });
      case "players.list":
        return {
          players: [{ name: "Steve", xuid: "", online: true }, { name: "Alex", xuid: "", online: true }, { name: "Notch_CN", xuid: "", online: true }],
          updatedAt: new Date(Date.now() - 4000).toISOString(),
          fresh: true,
          allowlist: structuredClone(instance.allowlist),
          permissions: structuredClone(instance.permissions),
          sfmcPermissions: structuredClone(instance.sfmcPermissions),
        };
      case "players.apply": return runTask(id, method, maintenance, () => { (instance as unknown as Record<string, unknown>)[String(params.kind)] = params.entries; });
      case "updates.check":
        await sleep(700);
        return {
          platform: id === "local-main"
            ? { currentVersion: "0.2.4", targetVersion: "0.2.4", releaseNotes: platformNotes, development: false, upgradeRequired: false, externalServices: ["llbot"], steps: [] }
            : { currentVersion: "0.2.3", targetVersion: "0.2.4", releaseNotes: platformNotes, development: false, upgradeRequired: true, externalServices: [], steps: ["下载固定版本的平台依赖组合", "停止受影响服务并确认进程退出", "备份配置、模块、数据库与世界", "切换平台并验证", "恢复此前运行的服务"] },
          modules: { failMode: "continue", applyOnStart: false, upgrades: [{ id: "sfmc-module-land", fromVersion: "1.4.2", toVersion: "1.5.0", spec: "npm:@sfmc-bds/module-land@1.5.0", requires: [] }], skipped: [{ id: "monitor", reason: "retired", fromVersion: "0.5.3", toVersion: null, detail: "" }, { id: "sfmc-module-activity-log", reason: "dev-link", fromVersion: "0.2.0-dev", toVersion: null, detail: "" }, { id: "sfmc-module-economy", reason: "up-to-date", fromVersion: "2.0.1", toVersion: "2.0.1", detail: "" }] },
          bds: { checked: true, updated: false, currentVersion: "1.26.51.01", latestVersion: "1.26.60.02", result: "check-only" },
        };
      case "updates.run": return runTask(id, method, maintenance);
      case "backups.list": return { backups: instance.tasks.filter((row) => row.phases.some((phase) => phase.name === "backup")).map((row) => row.id) };
      case "backups.restore": return runTask(id, method, ["stop-services", "restore-data", "verify", "restore"]);
      case "startup.plan":
        return id === "local-main"
          ? { filename: "install-sfmc-service.ps1", script: "#Requires -RunAsAdministrator\n$ErrorActionPreference = 'Stop'\n$wrapper = 'D:\\SFMC\\survival\\.sfmc\\runtime\\sfmc3f2a9c1b.exe'\nif (Get-Service -Name 'sfmc3f2a9c1b' -ErrorAction SilentlyContinue) { throw '系统服务已存在，不重复安装' }\nCopy-Item -LiteralPath 'D:\\SFMC\\survival\\.sfmc\\runtime\\WinSW-x64.exe' -Destination $wrapper\n$credential = Get-Credential -UserName 'shiro' -Message '输入原 Windows 部署账号'\nNew-Service -Name 'sfmc3f2a9c1b' -BinaryPathName ('\"' + $wrapper + '\"') -Credential $credential -StartupType Automatic\nStart-Service -Name 'sfmc3f2a9c1b'\n" }
          : { filename: "install-sfmc-service.sh", script: "#!/bin/sh\nset -eu\n[ \"$(id -u)\" = 0 ] || { echo '请以管理员运行此一次性安装脚本'; exit 1; }\nunit=/etc/systemd/system/sfmc-3f2a9c1b.service\nsystemctl daemon-reload\nsystemctl enable --now sfmc-3f2a9c1b.service\n" };
      case "deployment.create": return runTask(id, method, ["preflight", "prepare", "download", "start"]);
      default: throw new Error(`模拟桥未实现: ${method}`);
    }
  };

  const api: DesktopApi = {
    profiles: async () => structuredClone(profiles),
    saveProfile: async (profile) => {
      const id = profile.id || uuid();
      const index = profiles.findIndex((row) => row.id === id);
      const row = { ...profile, id };
      if (index >= 0) profiles[index] = row; else { profiles.push(row); instances.set(id, createInstance("ssh")); }
      return structuredClone(profiles);
    },
    removeProfile: async (id) => {
      const index = profiles.findIndex((row) => row.id === id);
      if (index >= 0) profiles.splice(index, 1);
      return structuredClone(profiles);
    },
    connect: async (id) => {
      await sleep(900);
      get(id).connected = true;
      return handshake(id);
    },
    disconnect: async (id) => {
      get(id).connected = false;
      for (const listener of connectionListeners) listener(id, "管理连接已断开: 客户端已断开");
    },
    confirmHost: async () => true,
    request: (id, method, params) => request(id, method, (params ?? {}) as Record<string, unknown>) as never,
    choose: async (kind) => (kind === "directory" ? "D:\\SFMC\\new-server" : "C:\\Users\\shiro\\.ssh\\id_ed25519"),
    uploadPack: async () => ({ filename: `${Date.now()}-Lucky_Blocks.mcaddon` }),
    update: async () => ({ portable: true, manual: true, available: true, version: "0.1.1", releaseNotes: { version: "0.1.1", title: "SFMC Desktop 0.1.1", status: "available", url: "https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases/tag/desktop-v0.1.1", publishedAt: "2026-10-03T03:00:00Z", body: "### 新增\n\n- 平台与桌面端更新前展示发行日志。\n- 关于入口显示桌面更新提醒。\n\n### 修复\n\n- 后台重连后自动恢复实时日志订阅。" } }),
    openLink: async (kind) => { console.info("[mock] openLink", kind); },
    appearance: async (mode: AppearanceMode) => { console.info("[mock] appearance", mode); },
    appInfo: async () => ({ version: "0.1.0", platform: "win32", packaged: false }),
    onEvent: (callback) => { eventListeners.add(callback); return () => eventListeners.delete(callback); },
    onConnection: (callback) => { connectionListeners.add(callback); return () => connectionListeners.delete(callback); },
  };
  window.sfmc = api;
}
