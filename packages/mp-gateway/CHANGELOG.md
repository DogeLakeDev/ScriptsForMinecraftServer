# @sfmc-bds/mp-gateway

## 0.3.1

### Patch Changes

- a443c65: 修复排行榜：未传 limit 时不再被夹成 1 行（在线时长本月/总计只显示自己）；财富排行改读经济账户表 sfmc_economy_accounts，与「我的」余额同源，并合并同一玩家的 xuid / 玩家名重复账户，不再出现计分板离线占位名。

## 0.3.0

### Minor Changes

- b574bfa: 网关启动后在后台确保依赖的实例服务在运行（默认 db），服务器重启后不再出现“健康检查正常、却登录不上”；可用 `--start-services` / `SFMC_MP_START_SERVICES` 调整，`none` 关闭。

### Patch Changes

- Updated dependencies [b574bfa]
  - @sfmc-bds/management@0.9.2

## 0.2.0

### Minor Changes

- b63d103: 小程序地图显示 land 模块的领地与区块网格：网关新增 `GET …/map/lands`（需要玩家会话，只读转发地图服务 `/api/lands`，只透出名称、领主名、状态、等级、按维度分组的区块与子区域的水平范围，不转发领主玩家 id）。此前小程序只读 `…/map/regions`，那里只有 area 模块的矩形区域，land 模块的领地不会出现。

  SDK 的 `service.get` / `service.call` 在服务不在本进程注册、走 HTTP 回退时不再使用 `URLSearchParams`（SAPI 脚本引擎没有该全局对象，此前会抛 `ReferenceError`，例如 bluemap 在 land 重载期间读取 `land.map`）。

### Patch Changes

- @sfmc-bds/management@0.9.1

## 0.1.4

### Patch Changes

- Updated dependencies [2c10360]
  - @sfmc-bds/management@0.9.1

## 0.1.3

### Patch Changes

- Updated dependencies [f70f65b]
  - @sfmc-bds/management@0.9.0

## 0.1.2

### Patch Changes

- Updated dependencies [20fefda]
  - @sfmc-bds/management@0.8.0

## 0.1.1

### Patch Changes

- Updated dependencies [e31e602]
- Updated dependencies [e31e602]
  - @sfmc-bds/management@0.7.0
