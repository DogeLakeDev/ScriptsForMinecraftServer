# 许可证一览

仓库根目录 [LICENSE](./LICENSE) 为 **GNU AGPL v3** 全文。各 npm 包按职责使用下列 SPDX 标识（见各包 `package.json` 的 `license` 字段）。

## 双轨策略

| 类型 | 许可证 | 说明 |
|------|--------|------|
| **作者向库** | [ISC](./modules/sdk/@sfmc-sdk/LICENSE) | 模块开发依赖的 SDK、ESLint 规则；便于第三方模块仓引用 |
| **平台与服务** | **AGPL-3.0-only** | CLI、db-server、QQ 桥、BDS 工具、devkit 等；网络服务与整体分发适用 copyleft |

业务模块（`sfmc-modules` 等独立仓库）许可证由各自仓库声明；通过 `@sfmc-bds/sdk` 开发不自动把模块变为 AGPL，但**修改并分发平台服务本身**仍须遵守 AGPL。

## 各包对照

| 包 | `license` | 包内 LICENSE 文件 |
|----|-----------|-------------------|
| `@sfmc-bds/sdk` | ISC | `modules/sdk/@sfmc-sdk/LICENSE` |
| `@sfmc-bds/eslint-plugin` | ISC | `modules/sdk/@sfmc-eslint-plugin/LICENSE` |
| `@sfmc-bds/cli` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/db-server` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/qq-bridge` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/bds-tools` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/tools` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/sfmc`（meta） | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `@sfmc-bds/devkit` | AGPL-3.0-only | 见仓库根 `LICENSE` |
| `sfmc-extension`（VS Code） | AGPL-3.0-only | 见仓库根 `LICENSE` |

## 变更记录

- 统一 `cli` 的 SPDX 拼写为 `AGPL-3.0-only`（原 `AGPL-v3.0-only` 无效）
- `meta` 由 `GPL-3.0-only` 改为 `AGPL-3.0-only`（与聚合的 AGPL 服务一致）
- `qq-bridge`、`bds-tools` 由 ISC 改为 AGPL-3.0-only（平台网络/运维组件）
- `@sfmc-bds/sdk` 包内 LICENSE 由 AGPL 全文改为 ISC 短文（与 `package.json` 一致）
