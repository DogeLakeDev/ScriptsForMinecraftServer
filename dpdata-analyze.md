现状分类
1. 长期数据或配置，应迁移到 db-server
- hpbe:shop_prices
- hpbe:shop_stocks
- hpbe:invswitcher_next
- coop/Database.ts 的内存 Map
- land/LandDatabase.ts 的内存 Map
其中合作社和土地当前并没有真正持久化，进程重启后数据会丢失，优先级最高。
2. 玩家运行时状态，可暂时保留 DynamicProperty
- hpbe:creative_area
- hpbe:creative_scores
- hpbe:dogefly
这些是玩家当前模式、区域和临时计分快照，不适合作为长期业务数据存储。
3. 实体状态，应继续保留在实体 DynamicProperty
- 全息实体的投影 ID
- 所属玩家 ID
- 缩放、透明度、旋转、显示层等渲染属性
这些属性跟随实体存档，迁移到 SQLite 反而会增加实体恢复和同步复杂度。
4. 监控指标，不是业务数据
- getDynamicPropertyTotalByteCount() 仅用于上报世界/玩家状态，不需要迁移。
建议执行顺序
1. 先为合作社和土地补上真正的 db-server 持久化。
2. 将商店价格和库存配置迁移到现有配置 API 或新增专用 API。
3. 将 invswitcher_next 迁移到 KV 存储。
4. 保留玩家运行时 DynamicProperty。
5. 保留全息实体 DynamicProperty。
6. 增加重启恢复和迁移测试，最后删除对应旧存储逻辑。
其中需要特别注意：coop/Database.ts 和 land/LandDatabase.ts 虽然注释写着“持久化”，实际只是进程内缓存，这是阶段 D 的第一个应该修复的问题。