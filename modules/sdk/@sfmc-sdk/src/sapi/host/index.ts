// @sfmc-bds/sdk/sapi/host — host adapter + 声明模块数据库/路由协议 + 配置加载
// 由 @sfmc-bds/sdk/module-loader 在 installHostBootstrap 时调用 bindDataAdapter 等接口装配。
//
// 当前阶段只导出:
//   - config: 路径解析 / SFMC_ROOT 等工具(从原 shared/sfmc-config 迁入)
//   - adapters 占位: Command / Permission / HttpDB / Money / Msg 等的 shape 接口
//     在 Stage F (core-* 模块迁移) 之后实装 adapters/<name>.ts 时填入。
//
// 完整的 SapiHostApis 14 字段 shape(commands/permissions/config/data/events/scheduler/
// rpc/services/logger/tools/economy/messages/ui/disposables)将在 Stage F 之前一次性
// 定型,具体在 sapi/sdk 中以同名 interface 声明。
export * from "./config/index.js";
export { SFMC_SAPI_HOST_VERSION } from "./version.js";
