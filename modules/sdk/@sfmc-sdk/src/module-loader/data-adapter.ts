/**
 * data-adapter.ts — db-server IO 抽象(SDK 公开契约,DIP)。
 *
 * ConfigManager 只依赖 `DataAdapter`,不知道 HttpDB / 网络协议;
 * 真实 IO 由 `@sfmc-bds/sdk/module-loader/http-data-adapter` 装配。
 * 测试 / 离线场景可注入自定义实现。
 */

/** db-server IO 抽象。ConfigManager 通过此接口拉取配置与启停状态。 */
export interface DataAdapter {
  /** 拉取所有配置(GET /api/sfmc/configs/all),返回 raw JSON 文本;失败时返回 null。 */
  getAllConfigs(): Promise<string | null>;
  /** 仅刷新模块开关(GET /api/sfmc/modules)。 */
  getModules(): Promise<string | null>;
  /** 设置 HTTP 鉴权 token。 */
  setAuthToken(token: string): void;
  /** 健康检查 db-server。 */
  checkHealth(): Promise<void>;
}