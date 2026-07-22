# 使用指南

面向服主和运维：把 SFMC 跑起来，并稳定日常维护。

## 阅读顺序

| 章节 | 内容 |
|------|------|
| [概览](./overview.md) | SFMC 是什么、组件与端口 |
| [安装](./install.md) | 环境要求、SEA / monorepo 两条路 |
| [首次运行](./first-run.md) | 向导、默认配置 |
| [服务管理](./services.md) | sfmc CLI、启停顺序 |
| [模块](./modules.md) | 安装、启停、命名 |
| [行为包](./behavior-pack.md) | build / deploy |
| [QQ 互通](./qq-bridge.md) | LLBot 对接 |
| [配置说明](./config.md) | 各 JSON 文件做什么 |
| [备份与升级](./backup-upgrade.md) | 数据、模块、BDS 更新 |
| [排障](./troubleshooting.md) | 常见问题 |

## 两条部署路

- **SEA 单文件**：下载 Release 里的 `sfmc`，适合不想碰 Node 的服主
- **npm monorepo**：clone 仓库开发或二次定制

两条路共用同一套模块注册表、fetch 工具和 pack-manager。

## 重要提醒

改 `configs/` 或模块启停后，**重启 BDS** 才在游戏里生效；配置没有热重载。
