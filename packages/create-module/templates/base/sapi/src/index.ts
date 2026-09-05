/**
 * {{pkgName}} — {{name}}
 * 由 @sfmc-bds/create-module 生成。
 */

import { ModuleRegistry, type ModuleDescriptor, type ModuleServices } from "@sfmc-bds/sdk/module-loader";
import { Command, Msg, Permission } from "@sfmc-bds/sdk/sapi/runtime";

/** 与 sapi/manifest.json 的 id 一致（逻辑 id，非文件夹短名）。 */
export const MODULE_ID = "{{featureId}}";

/** 命令权限名。 */
export const PERM = "{{configKey}}.use";

function registerPermissions(): void {
  Permission.register(PERM, Permission.Any);
}

function registerCommands(services?: ModuleServices): void {
  // 指令回调若访问 db，请闭包捕获 services?.db（勿依赖单例 import { db }，避免多模块身份串桶）
  void services;
  Command.register(
    "{{cmdName}}",
    PERM,
    (player) => {
      if (!player) return;
      Msg.info("{{readyMsg}}", player);
    },
    "{{name}}",
    MODULE_ID
  );
}

function registerEvents(): void {
  /* 事件订阅放在本阶段，不要放进 init()。 */
}

function init(services?: ModuleServices): void {
  /* TODO: 用 services?.config / services?.db 读配置、注册表等 */
  void services;
}

function cleanup(): void {
  /* TODO: 取消事件订阅、关闭 handle、清理定时器。 */
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

ModuleRegistry.register(DESCRIPTOR);
