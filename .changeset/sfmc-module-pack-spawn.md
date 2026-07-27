---
"@sfmc-bds/cli": minor
---

feat(sfmc): module build / reload 改走 spawn bds-tools/cli-pack-manager.ts

- 新增 sfmc/src/module-pack-build.ts：spawn assemble-bp / assemble-rp / deploy / enable-pack / disable-pack / ensure-permission 各 verb
- dispatchModuleCommand 的 build / reload case 改为 import 此文件
- pack-lifecycle.ts 保留 ensurePacksReady 启动钩子与 wizard 内部消费
- 模块 build 唯一权威派发入口收敛（与 install/uninstall/create 同架构：CLI = thin wrapper）