import type { Handshake } from "./handshake.js";
import type { OperationAccepted, OperationsGetResult, OperationsListResult } from "./operations.js";
import type { LogsDeleteResult, LogsTailResult } from "./logs.js";
import type { ServicesListResult } from "./services.js";
import type { MetricsResult } from "./metrics.js";
import type { ActivityQueryResult, ActivityStatsResult } from "./activity.js";
import type { ScoreboardApplyResult, ScoreboardPublicObjectivesResult, ScoreboardReadResult } from "./scoreboard.js";

/**
 * 配置表单的单个字段描述。
 * 使用场景：平台随 config.read 下发（目前用于 server.properties 的完整字段清单），
 * 桌面端与小程序据此渲染表单控件；桌面端 config-form 的 FieldSpec 即此类型。
 */
export interface ConfigFormField {
  key: string;
  /** 展示名称（缺省用 key） */
  label?: string;
  description?: string;
  kind: "boolean" | "number" | "string" | "enum" | "secret";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  integer?: boolean;
  /** 字段分组标题 */
  group?: string;
}
export interface ConfigDocument {
  key: string;
  text: string;
  revision: string;
  schema?: object;
  format: "json" | "jsonc" | "properties";
  affectedServices: string[];
  /**
   * 平台提供的表单字段清单（按展示顺序）。目前只有 server.properties 提供。
   * 旧平台没有该字段；界面应回退到内置的常用字段清单。
   */
  fields?: ConfigFormField[];
}
export interface ModuleRow { id: string; folder: string; name: string; version: string; enabled: boolean; linked: boolean }
export interface PackRow {
  id: string;
  name: string;
  kind: "behavior" | "resource";
  enabled: boolean;
  /** 清单 header.version，形如 1.2.7 */
  version: string;
  /**
   * pack_icon.png 的 size:mtime。有值表示可以再请求 packs.icon。
   * 旧平台没有该字段；界面应回退到类型图标。
   */
  iconStamp?: string;
  /** 平台聚合包。为 true 时不能走世界包卸载，应使用模块管理。 */
  protected?: boolean;
}
/** packs.icon 的结果。没有可读 PNG 时 mime 与 data 均为 null。 */
export interface PackIconResult {
  id: string;
  mime: "image/png" | null;
  /** 标准 base64，不含 data: 前缀 */
  data: string | null;
}
/** 世界包导入预检：复用 REPL 的同 UUID / 版本覆盖规则。 */
export interface PackImportPlan {
  revision: string;
  packs: {
    id: string;
    name: string;
    kind: PackRow["kind"];
    version: string;
    action: "install" | "update" | "conflict";
    existing?: { name: string; version: string };
  }[];
}
export interface PackImportOptions {
  /** 允许覆盖同版本或旧版本，必须同时提供预检 revision。 */
  force?: boolean;
  revision?: string;
}
export interface PlayerRow { name: string; xuid: string; online: boolean | null }
/** 绑定白名单的一行，对应业务库 sfmc_qq_bindings。 */
export interface QqBinding {
  playerName: string;
  playerXuid: string;
  qqUserOpenid: string;
  qqBackend: string;
  boundAt: number;
}
export interface ReleaseNotes {
  version: string;
  title: string;
  body: string;
  url: string;
  status: "available" | "empty" | "unavailable";
  publishedAt?: string;
  prerelease?: boolean;
  message?: string;
}
export interface AttachmentPlan {
  currentVersion: string;
  targetVersion: string;
  development: boolean;
  upgradeRequired: boolean;
  externalServices: string[];
  steps: string[];
  releaseNotes?: ReleaseNotes;
}
export interface ManagementMethodMap {
  handshake: Handshake;
  "services.list": ServicesListResult;
  "services.start": OperationAccepted;
  "services.stop": OperationAccepted;
  "services.restart": OperationAccepted;
  "services.send": { delivered: boolean };
  "events.subscribe": { subscribed: true };
  "logs.tail": LogsTailResult;
  /** 按时间范围删除落盘日志。可再用来源和正文收窄到某一条。 */
  "logs.delete": LogsDeleteResult;
  "modules.list": { modules: ModuleRow[] };
  "modules.search": { modules: unknown[] };
  "modules.install": OperationAccepted;
  "modules.uninstall": OperationAccepted;
  "modules.toggle": OperationAccepted;
  "config.list": { keys: string[] };
  "config.read": ConfigDocument;
  /** 仅校验并保存文件，不改变服务运行状态。 */
  "config.save": OperationAccepted;
  "config.apply": OperationAccepted;
  "packs.list": { packs: PackRow[] };
  /** 按包 UUID 读取 pack_icon.png。不存在或不是 PNG 时返回空图标，不报错。 */
  "packs.icon": PackIconResult;
  "packs.import.plan": PackImportPlan;
  "packs.import": OperationAccepted;
  "packs.toggle": OperationAccepted;
  /** 卸载指定世界包。行为包的配对资源包一并移入卸载回收站。 */
  "packs.uninstall": OperationAccepted;
  /** 修改资源包清单版本（major.minor.patch）。行为包拒绝。已启用时同步世界启用列表。 */
  "packs.version": OperationAccepted;
  "players.list": { players: PlayerRow[]; updatedAt: string; fresh: boolean; allowlist: unknown[]; permissions: unknown[]; sfmcPermissions: unknown[]; bindings: QqBinding[] };
  "players.apply": OperationAccepted;
  "metrics.read": MetricsResult;
  /** 分页查询行为日志模块的记录（只读）。参数见 ActivityQueryParams。 */
  "activity.query": ActivityQueryResult;
  /** 按筛选条件统计行为日志（事件类型、级别、活跃玩家）。参数见 ActivityFilterParams。 */
  "activity.stats": ActivityStatsResult;
  /** 读取游戏内同步的计分板快照。参数见 ScoreboardReadParams。 */
  "scoreboard.read": ScoreboardReadResult;
  /** 把计分板编辑操作转成控制台命令发送给 BDS。参数见 ScoreboardApplyParams。 */
  "scoreboard.apply": ScoreboardApplyResult;
  /** 读取玩家端排行公开的计分项 id 列表。 */
  "scoreboard.publicObjectives": ScoreboardPublicObjectivesResult;
  /** 把某个计分项加入或移出公开名单。参数见 ScoreboardSetPublicObjectiveParams。 */
  "scoreboard.setPublicObjective": ScoreboardPublicObjectivesResult;
  "updates.check": unknown;
  "updates.run": OperationAccepted;
  "attachment.plan": AttachmentPlan;
  "attachment.apply": OperationAccepted;
  "deployment.create": OperationAccepted;
  "operations.list": OperationsListResult;
  "operations.get": OperationsGetResult;
  "backups.list": { backups: string[] };
  /** 手动停服创建全量快照，完成后恢复此前运行的服务。 */
  "backups.create": OperationAccepted;
  "backups.restore": OperationAccepted;
  /** 删除一份备份目录。不停止服务，也不改动当前世界。 */
  "backups.delete": OperationAccepted;
  "startup.plan": { script: string; filename: string };
}
export type ManagementMethod = keyof ManagementMethodMap;
