/**
 * @sfmc-bds/module-example — 示例模块
 * 由 sfmc-module-template 生成；运行 `node scripts/rename.mjs <kebab-id> [--name "..."]` 改名。
 *
 * 黄金路径：
 *   1) node scripts/rename.mjs my-feature --name "我的功能"
 *   2) npm install
 *   3) npm run typecheck
 *   4) （在主仓）sfmc mod install --from local --link
 *   5) sfmc mod enable <id> && sfmc mod reload
 *   6) sfmc mod watch   # 改源码即 rebuild + reload
 *   7) sfmc mod test    # node --test + @sfmc-bds/sdk/testing
 *   8) sfmc mod publish # 保姆式发布：登录引导 + bump + npm publish + 薄 index PR
 */

import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Command, Permission, Msg } from "@sfmc-bds/sdk/sapi/runtime";

const MODULE_ID = "feature-example";
const PERM = "example.use";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register(PERM, Permission.Any);
    },
    registerCommands() {
      Command.register(
        "example",
        PERM,
        (player) => {
          Msg.info(`模块示例已就绪 — 你好 ${player?.name ?? "?"}`);
        },
        "示例命令"
      );
    },
    async init() {
      // 首次启用时读取 configs/example.json；可在此注册 db 表 / service。
    },
    cleanup() {
      // 关闭连接 / 清理 timer。
    },
  },
});
