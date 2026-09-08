---
"@sfmc-bds/sdk": patch
"@sfmc-bds/bds-tools": patch
"@sfmc-bds/cli": patch
"@sfmc-bds/db-server": patch
---

fix: BDS 原生依赖过滤与协商、模块作用域代理及数据库表结构解耦与自愈

- **bds-tools**: 引入 Bedrock 原生脚本模块白名单机制，过滤 npm 纯数据包；支持自动识别并启用 level.dat 中的 gametest beta 实验性玩法；增强 server.properties 中文本地化与幂等更新。
- **cli**: 行为包打包期与各模块原生依赖严格协商，协商提升 Bedrock 原生依赖至兼容最高版本；重构 esbuild SDK resolve 插件，为所有包含 `/sapi/` 的业务模块（含跨仓 symlink/junction）自动注入专属作用域虚拟代理，杜绝全局单例状态覆盖与越权。
- **db-server**: 精简 `initSchema`，移除非底座的业务模块表定义，实现平台核心底座表与业务模组私有表契约解耦；增强 `SchemaRegistry.createPhysical`，自动探测并安全清理历史旧版空表，支持存量表平滑自愈追加缺失列。
- **sdk**: 优化调试日志门面，显式格式化错误名称、信息与堆栈追踪；确保 SAPI 客户端安全注入请求头；修复 host bootstrap 导出边界以保证 Node 环境引用纯净。
