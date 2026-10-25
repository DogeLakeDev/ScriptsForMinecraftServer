# @sfmc-bds/miniprogram

SFMC 的微信小程序：玩家端 + 管理端合在一个小程序里（避免两个小程序分别备案）。使用原生小程序、TypeScript 和 WeUI 扩展库，界面沿用桌面端的 SnowUI 配色并支持深色模式。小程序通过 [`@sfmc-bds/mp-gateway`](../mp-gateway/README.md) 访问服务器。

- **玩家端**（主包，原生标签栏「首页 / 排行 / 我的」）：面向东方犬明湖的玩家。本轮提供微信登录、绑定游戏账号（6 位绑定码，在游戏内 `/c:bind` 后发送）、查看余额与在线时长，以及「我的 → 我的行为记录」（服务器安装行为日志模块后可用）；首页与排行为占位，具体功能待讨论。
- **管理端**（`admin` 分包，二级入口）：SFMC Desktop 的移植版——实例概览（服务、TPS / 在线 / 内存曲线、告警）、控制台、任务、模块、世界包、配置文件（纯文本编辑）、玩家权限、行为日志、更新与备份。不包含 UI Studio 和新部署初始化。底部导航为自定义组件 `components/admin-nav`。

## 开发

```bash
pnpm install
pnpm --filter @sfmc-bds/miniprogram build      # 生成 vendor/ 与图标样式
pnpm --filter @sfmc-bds/miniprogram typecheck
```

`build` 会把 `@sfmc-bds/management` 和桌面端 `renderer/lib` 中的纯函数打包到 `miniprogram/vendor/`，从 Phosphor 生成 `styles/icons.wxss`，并按 `theme.json` 生成原生标签栏的浅色 / 深色 PNG 图标（`assets/tabbar/`）。这些产物都不提交，克隆后或修改上游后需重新执行。

然后用微信开发者工具打开本目录（`packages/miniprogram`，不是里面的 `miniprogram/`）。TypeScript 由开发者工具的编译插件处理。

脚本目录分两处：主包 `miniprogram/core/` 只放主包页面或组件会用到的模块；只被管理端页面使用的模块放在分包的 `miniprogram/admin/core/`（分包可以引用主包模块，反过来不行）。放错位置时，开发者工具的代码质量检查会提示「主包内不应存在主包未使用的JS文件」。

玩家端服务器地址写在 `miniprogram/core/server.ts` 的 `HOME_SERVER.endpoint`（mp-gateway 地址，例如 `https://mc.example.com/sfmc`），留空时玩家端只显示配置提示。网关需配置 `SFMC_MP_WX_APPID` / `SFMC_MP_WX_SECRET` 才能微信登录。

本地调试网关时，在开发者工具「详情 → 本地设置」中勾选「不校验合法域名」，网关地址填 `http://<电脑 IP>:3910`（网关需用 `--host 0.0.0.0` 启动）。真机和正式版必须使用 https / wss 并配置 request 与 socket 合法域名，参见网关 README。

## 进入管理端

管理端入口在「我的 → 服务器管理 → 进入管理端」，始终显示，按身份有两种用法：

1. **微信管理员**：微信绑定的游戏账号在 SFMC 中为 3 级（Admin）。首次进入时自动建立“微信身份”实例档案，不需要令牌；网关每次连接都现查等级，降级后立即失去访问。管理员还可以在「我的 → 登录桌面端」扫码或输入 6 位登录码，批准 SFMC Desktop 登录；已授权的设备在「管理 → 已授权设备」中查看与撤销。
2. **访问令牌**：其他用户按令牌方式管理实例（改造前的用法）。还没有实例时，管理端首页的连接提示提供「添加实例」；已有实例时点击概览页顶部的实例名进入实例列表。添加实例需填写网关地址与令牌，保存前可先「测试连接」。实例档案（含令牌）只保存在手机本地存储中。
