/**
 * 测试 fixture：模块入口的典型导出样式，覆盖 const/function/class/enum/type/interface/re-export/default。
 */

import { ModuleRegistry, type ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import { Command, Msg, Permission } from "@sfmc-bds/sdk/sapi/runtime";

/** 模块 id（逻辑 id）。 */
export const MODULE_ID = "sample-module";

/** 命令权限名。 */
export const PERM = "sample.use";

export function registerPermissions(): void {
  Permission.register(PERM, Permission.Any);
}

export class SampleService {
  public greet(name: string): string {
    return `hello ${name}`;
  }
}

export enum SampleLevel {
  Low = 0,
  High = 1,
}

export interface SampleConfig {
  threshold: number;
}

export type SampleCount = number;

function registerCommands(): void {
  Command.register("sample", PERM, (player) => {
    if (!player) return;
    Msg.info("sample ready", player);
  });
  Command.register("sample-info", PERM, () => {
    /* detail */
  });
}

function registerEvents(): void {
  /* no-op */
}

function init(): void {
  /* no-op */
}

function cleanup(): void {
  /* no-op */
}

export const DESCRIPTOR: ModuleDescriptor = {
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions,
    registerCommands,
    registerEvents,
    init,
    cleanup,
  },
};

export default DESCRIPTOR;

ModuleRegistry.register(DESCRIPTOR);