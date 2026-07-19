# @sfmc/logs

ScriptsForMinecraftServer 项目统一日志接口。

被以下组件共用（`scriptsforminecraftserver` SAPI 不在范围内）：

- `db-server/` (ESM)
- `qq-bridge/` (ESM)
- `bds-tools/` (CJS)
- `sfmc/` (ESM)

## 特性

- **零运行时依赖**：用纯 ANSI 转义码做可选颜色，不引入 chalk
- **ESM + CJS 双格式输出**：通过 `package.json` `exports` 条件导出，兼容所有组件的模块系统
- **统一接口**：`createLogger({ source, sinks })` 工厂 + `log.info/warn/error/debug/success`
- **可插拔 Sink**：`createStdoutSink`（带 TTY 自动检测）、`createFileSink`（纯文本落盘）、`createCallbackSink`
- **进程内内存缓冲**：`createMemoryBuffer` 供 sfmc 主进程聚合展示子进程日志
- **格式化纯函数**：`inferLevel`、`formatLog`、`formatLogLine`、`highlightText`、`levelTag`

## source 命名约定

| 组件 | source |
|------|--------|
| db-server | `"db"` |
| qq-bridge | `"qq"` |
| bds-tools/bds-manager | `"bds-tools"` |
| bds-tools/check-update | `"updater"` |
| sfmc 自身 | `"system"` |
| sfmc 捕获的子进程 | 服务名（`bds` / `db` / `qq` / `llbot`） |

## 用法

```ts
import { createLogger, createStdoutSink, createFileSink } from "@sfmc/logs";

const fileSink = createFileSink("./update.log");
export const log = createLogger({
  source: "db",
  sinks: [createStdoutSink(), fileSink],
});

log.info("server started");
log.error("failed to bind port");
log.err(new Error("boom"), "init");
```

## 构建

```bash
npm run build      # 输出 dist/esm + dist/cjs + dist/types
npm run typecheck
```
