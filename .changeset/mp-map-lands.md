---
"@sfmc-bds/mp-gateway": minor
"@sfmc-bds/sdk": patch
---

小程序地图显示 land 模块的领地与区块网格：网关新增 `GET …/map/lands`（需要玩家会话，只读转发地图服务 `/api/lands`，只透出名称、领主名、状态、等级、按维度分组的区块与子区域的水平范围，不转发领主玩家 id）。此前小程序只读 `…/map/regions`，那里只有 area 模块的矩形区域，land 模块的领地不会出现。

SDK 的 `service.get` / `service.call` 在服务不在本进程注册、走 HTTP 回退时不再使用 `URLSearchParams`（SAPI 脚本引擎没有该全局对象，此前会抛 `ReferenceError`，例如 bluemap 在 land 重载期间读取 `land.map`）。
