# @sfmc-bds/miniprogram

SFMC Desktop 的微信小程序移植版。使用原生小程序、TypeScript 和 WeUI 扩展库，界面沿用桌面端的 SnowUI 配色并支持深色模式。小程序通过 [`@sfmc-bds/mp-gateway`](../mp-gateway/README.md) 管理实例。

功能：实例概览（服务、TPS / 在线 / 内存曲线、告警）、控制台、任务、模块、世界包、配置文件（纯文本编辑）、玩家权限、更新与备份。不包含 UI Studio 和新部署初始化。

## 开发

```bash
pnpm install
pnpm --filter @sfmc-bds/miniprogram build      # 生成 vendor/ 与图标样式
pnpm --filter @sfmc-bds/miniprogram typecheck
```

`build` 会把 `@sfmc-bds/management` 和桌面端 `renderer/lib` 中的纯函数打包到 `miniprogram/vendor/`，从 Phosphor 生成 `styles/icons.wxss`，并按 `theme.json` 生成原生标签栏的浅色 / 深色 PNG 图标（`assets/tabbar/`）。这些产物都不提交，克隆后或修改上游后需重新执行。

然后用微信开发者工具打开本目录（`packages/miniprogram`，不是里面的 `miniprogram/`）。TypeScript 由开发者工具的编译插件处理。

本地调试网关时，在开发者工具「详情 → 本地设置」中勾选「不校验合法域名」，网关地址填 `http://<电脑 IP>:3910`（网关需用 `--host 0.0.0.0` 启动）。真机和正式版必须使用 https / wss 并配置合法域名，参见网关 README。

## 使用

1. 在服务器上启动网关，记下访问令牌。
2. 点击概览页顶部的实例名（或连接提示中的「添加实例」）进入实例列表，添加实例并填写网关地址与令牌，保存前可先「测试连接」。
3. 实例档案（含令牌）只保存在手机本地存储中。
