/**
 * {{pkgName}} — {{name}}
 * 由 @sfmc-bds/create-module 生成。
 */

import { ModuleRegistry, type ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import { Command, Msg, Permission } from "@sfmc-bds/sdk/sapi/runtime";

/** 与 sapi/manifest.json 的 id 一致（逻辑 id，非文件夹短名）。 */
export const MODULE_ID = "{{featureId}}";

/** 命令权限名。 */
export const PERM = "{{configKey}}.use";

function registerPermissions(): void {
  Permission.register(PERM, Permission.Any);
}

function registerCommands(): void {
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

function init(): void {
  /* TODO: 读取 configs/{{configKey}}.json、注册 db 表等 */
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
