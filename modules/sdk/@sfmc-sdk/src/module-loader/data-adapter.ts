/**
 * data-adapter.ts — db-server IO 抽象(SDK 公开契约)。
 *
 * 真实 IO 由 `module-loader/install` 经 `createHttpDataAdapter` 装配。
 * 测试 / 离线场景可注入自定义实现。
 */

/** db-server IO 抽象。ConfigManager 通过此接口拉取配置。 */
export interface DataAdapter {
  /** 拉取所有配置(GET /api/sfmc/configs/all),返回 raw JSON 文本;失败时返回 null。 */
  getAllConfigs(): Promise<string | null>;
  /** 设置 HTTP 鉴权 token。 */
  setAuthToken(token: string): void;
  /** 健康检查 db-server。 */
  checkHealth(): Promise<void>;
}
