/** 玩家设置
 * @param id 玩家id
 * @param name 玩家名称
 *
 * @param clientSystemInfo 客户端系统信息
 * @param graphicsMode 图形模式
 * @param dynamicPropertyTotalByteCount 动态属性总字节数 可用于辅助判断性能 过大的字节数会对存档造成压力
 * @param ping 延迟
 *
 * @param dimension 当前维度
 * @param level 等级
 * @param location 当前位置
 * @param gameMode 游戏模式
 * @param spawnPoint 重生点
 * @param tags 标签列表
 * @param totalXp 总经验
 *
 * @param afkStep AFK 步数
 * @param afkLastLocation AFK 前位置
 *
 * @param onlineSession 本次在线时长（秒）
 * @param onlineToday 今日在线时长（秒）
 * @param onlineMonth 本月在线时长（秒）
 * @param onlineTotal 总在线时长（秒）
 * @param onlineLastDate 最后活跃日期
 * @param onlineLastMonth 最后活跃月份
 *
 * @param permission 权限等级
 *
 * @param activeChannel 玩家当前活跃频道ID
 *
 * @param updatedAt 更新时间戳 */
export interface PlayerData {
  id: string;
  name: string;
  permission?: number; // *

  clientSystemInfoLocal?: string;
  clientSystemInfoMaxRenderDistance?: number;
  clientSystemInfoMemoryTierLevel?: string;
  clientSystemInfoPlatformType?: string;
  graphicsMode?: string;
  dynamicPropertyTotalByteCount?: number;
  ping?: number; // *

  level?: number;
  spawnPoint?: string;
  tags?: string;
  totalXp?: number;

  afkStep?: number; // *
  afkLastLocation?: { x: number; y: number; z: number }; // *
  onlineSession?: number; // *
  onlineToday?: number; // *
  onlineMonth?: number; // *
  onlineTotal?: number; // *
  onlineLastDate?: number; // *
  onlineLastMonth?: number; // *
  activeChannel?: string; // *

  updatedAt: string;
}
