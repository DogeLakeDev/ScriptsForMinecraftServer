import type { Handshake } from "./handshake.js";
import type { OperationAccepted, OperationsGetResult, OperationsListResult } from "./operations.js";
import type { LogsTailResult } from "./logs.js";
import type { ServicesListResult } from "./services.js";
import type { MetricsResult } from "./metrics.js";

export interface ConfigDocument {
  key: string;
  text: string;
  revision: string;
  schema?: object;
  format: "json" | "jsonc" | "properties";
  affectedServices: string[];
}
export interface ModuleRow { id: string; folder: string; name: string; version: string; enabled: boolean; linked: boolean }
export interface PackRow { id: string; name: string; kind: "behavior" | "resource"; enabled: boolean; version: string }
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
  "modules.list": { modules: ModuleRow[] };
  "modules.search": { modules: unknown[] };
  "modules.install": OperationAccepted;
  "modules.uninstall": OperationAccepted;
  "modules.toggle": OperationAccepted;
  "config.list": { keys: string[] };
  "config.read": ConfigDocument;
  "config.apply": OperationAccepted;
  "packs.list": { packs: PackRow[] };
  "packs.import": OperationAccepted;
  "packs.toggle": OperationAccepted;
  "players.list": { players: PlayerRow[]; updatedAt: string; fresh: boolean; allowlist: unknown[]; permissions: unknown[]; sfmcPermissions: unknown[]; bindings: QqBinding[] };
  "players.apply": OperationAccepted;
  "metrics.read": MetricsResult;
  "updates.check": unknown;
  "updates.run": OperationAccepted;
  "attachment.plan": AttachmentPlan;
  "attachment.apply": OperationAccepted;
  "deployment.create": OperationAccepted;
  "operations.list": OperationsListResult;
  "operations.get": OperationsGetResult;
  "backups.list": { backups: string[] };
  "backups.restore": OperationAccepted;
  "startup.plan": { script: string; filename: string };
}
export type ManagementMethod = keyof ManagementMethodMap;
