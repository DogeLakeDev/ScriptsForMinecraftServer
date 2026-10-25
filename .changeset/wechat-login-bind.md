---
"@sfmc-bds/db-server": minor
"@sfmc-bds/sdk": minor
"@sfmc-bds/management": minor
---

支持小程序微信登录与微信绑定。db-server 新增微信绑定表与 `/api/sfmc/wechat/bind/*` 接口，可按 openid 查询绑定、账号资料与 SFMC 有效等级；游戏内 `/c:bind` 改走统一入口 `/api/sfmc/bind/confirm`，按绑定码所属渠道确认 QQ 或微信绑定，旧接口 `/api/sfmc/qq/bind/confirm` 保留。SDK 的绑定确认优先调用统一入口，平台未升级时回退旧接口，并导出有效权限等级的计算函数。management 新增桌面端扫码登录链接的编码与解析（`sfmc://device-login`）。
