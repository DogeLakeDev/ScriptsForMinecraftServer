/**
 * panels/lock.ts — 再导出平台契约（与 CLI / db-server 同源，DRY）
 */
export type {
  ModuleLock,
  ModuleRuntimeState as ModuleLockEntry,
} from "@sfmc-bds/sdk/contracts";
