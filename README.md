# ScriptsForMinecraftServer

本项目是一个基于 **SAPI (Script API)** 的 Minecraft Bedrock 服务器行为包插件，同时包含一些辅助功能网页。

## 功能总览

### 核心

| 模块 | 说明 |
| --- | --- |
| **命令系统** | 支持 `!<command>` 和 `/scriptevent doge:<command>` 两种调用方式 |
| **计分板金钱** | 以计分板为数据源的货币系统 |
| **权限管理** | 基于字符串的权限节点，可选 Any / OP / Admin 权限等级，集成细粒度权限管理 |
| **配置** | 集中管理区域、箱子布局、清理参数等 |

### 一键菜单

由 `doge/Menu.ts` + `data/menu/*` 配置驱动的主菜单，包含常用功能入口。

### DogeChat 频道化聊天系统

基于频道的聊天系统，所有频道对所有人可见，通过切换活跃频道决定消息收发。

**频道类型：**

| 类型 | 预制 | 说明 |
| --- | --- | --- |
| 公共频道 | 自动创建 | 全服默认频道，所有人可发言，保留 7 天 |
| 公告频道 | 自动创建 | 公告板模式，仅管理员可发言，消息永久保存，每条显示时间戳 |
| 系统频道 | 玩家进服自动创建 | 每人独立，Msg 消息自动写入，只读，保留 1 天 |
| 私聊频道 | 首次私聊时自动创建 | 双向私聊，保留 30 天 |
| 自定义频道 | 玩家/管理创建 | 可配置公告板模式、慢速模式等属性，保留 7 天 |

**频道属性：**

| 属性 | 说明 |
| --- | --- |
| `isBroadcast` | 公告板模式：仅管理员可发言，消息推送给所有人，永久保存 |
| `allowChat` | 是否允许聊天（系统频道为 false） |
| `slowMode` | 发言间隔限制（秒），0 为无限制 |

**命令：**

| 命令 | 功能 |
| --- | --- |
| `!channel` | 打开频道管理主面板 |
| `!ch` | 快捷循环切换活跃频道（跳过私聊） |
| `!msg` | 快捷私聊面板 |
| `!lo` | 发送当前位置到当前频道 |
| `!tp` | 发送传送邀请（私聊直接发送，多人弹窗选人） |
| `!hongbao` | 红包面板（发送 + 领取） |
| `!hb` | 快捷发送红包 |

**消息同步：**

切换频道或进服时自动加载历史消息，默认为上下文超过 5 分钟展示时间戳。

### 商店

**箱子商店** — 使用双箱子存放货物，类似 Clean / InventorySwitcher 的布局方式。

- 通过 `Config.shopChest` 配置箱子区域（起点、网格尺寸、方向）
- `!shop` 打开商店 GUI，浏览分类、查看物品详情
- 支持购买和回收（价格由 Dynamic Property 持久化）
- `Money.UNIT` 统一货币单位

### 土地

完整的领土管理功能：

- 创建/删除领地
- 领地权限管理（破坏、放置、交互、容器访问等）
- 领地成员管理
- 领地传送
- 领地保护开关

### 合作社系统

- 合作社创建/加入/退出
- 合作社成员管理
- 合作社权限控制

### 区域控制

| 模块 | 说明 |
| --- | --- |
| **区域飞行** | 在指定区域内允许生存模式飞行 |
| **区域和平** | 在指定区域内阻止怪物生成 |
| **创造区域** | 进入指定区域自动切换创造模式 |
| **生存区域** | 进入指定区域自动切换生存模式 |
| **创造区禁放列表** | 配置禁止放置的方块（红石元件、功能方块等） |

### 实用功能

| 模块 | 说明 |
| --- | --- |
| **AFK 检测** | 超时自动标记 AFK，可配合踢出逻辑 |
| **掉落物清理** | 掉落物超过阈值自动清理至回收箱，支持白名单 |
| **生物控制** | 手动清除/临时清除附近实体 |
| **背包切换** | 生存/创造模式切换时自动保存和恢复独立背包（箱子存储） |
| **入服保护** | 玩家刚进服时给予短暂保护 |
| **知识竞猜** | 定时随机出题，答对奖励 |
| **在线时长** | 记录玩家在线时长 |
| **TPS 检测** | 服务器 TPS 监控 |
| **聊天音效** | 聊天关键词触发音效 |
| **计分板同步** | 定时将游戏计分板同步至外部 SQLite 数据库，支持恢复 |
| **行为日志** | 记录玩家原版行为（方块、战斗、聊天等）至 SQLite，可追溯查询 |

### 动态属性编辑器

`gui/DpEditor.ts` — 侧边栏工具，用于查看和编辑 `world.setDynamicProperty` 存储的数据，支持 NBT 解析和编辑。

### 金钱指令

| 命令 | 功能 |
| --- | --- |
| `!money` | 查看余额 |
| `!pay <玩家> <金额>` | 转账 |
| `!setmoney <玩家> <金额>` | 设置余额（管理） |
| `!addmoney <玩家> <金额>` | 增加余额（管理） |
| `!reduce <玩家> <金额>` | 减少余额（管理） |

---

## 文件结构

```txt
ScriptsForMinecraftServer/
├── db-server/                    # SQLite 数据库 HTTP 服务
│   └── index.js                  #   REST API 服务入口
├── scriptsforminecraftserver/
│   ├── scripts/
│   │   ├── area/                  # 区域控制
│   │   │   ├── CreativeArea.ts    #   创造区域
│   │   │   ├── Fly.ts             #   区域飞行
│   │   │   ├── Peace.ts           #   区域和平
│   │   │   └── SurvivalArea.ts    #   生存区域
│   │   ├── backup/                # 数据备份/同步
│   │   │   └── ScoreboardSync.ts  #   计分板同步模块
│   │   ├── chat/                  # 聊天系统
│   │   │   └── ChatSystem.ts      #   频道聊天初始化
│   │   ├── coop/                  # 合作社
│   │   │   ├── CoopCore.ts        #   合作社核心逻辑
│   │   │   ├── CoopSystem.ts      #   合作社系统
│   │   │   └── Database.ts        #   数据持久化
│   │   ├── data/                  # 数据/配置
│   │   │   ├── Config.ts          #   全局配置
│   │   │   ├── Permission.ts      #   权限数据
│   │   │   ├── Questions.ts       #   知识竞猜题库
│   │   │   ├── Shop.ts            #   商店商品数据（旧表单商店）
│   │   │   └── menu/              #   菜单配置
│   │   │       ├── index.ts
│   │   │       ├── main.ts
│   │   │       ├── more.ts
│   │   │       ├── tp.ts
│   │   │       └── ad1.ts
│   │   ├── doge/                  # 功能模块
│   │   │   ├── ActivityLog.ts     #   行为日志
│   │   │   ├── AFK.ts             #   AFK 检测
│   │   │   ├── Clean.ts           #   掉落物清理
│   │   │   ├── ChatSystem.ts      #   频道聊天初始化
│   │   │   ├── DogeChat.ts        #   频道聊天核心
│   │   │   ├── EntityControl.ts   #   生物控制
│   │   │   ├── InventorySwitcher.ts # 背包切换
│   │   │   ├── Menu.ts            #   菜单
│   │   │   ├── OnlineTime.ts      #   在线时长
│   │   │   ├── QA.ts              #   知识竞猜
│   │   │   ├── SpawnProtect.ts    #   入服保护
│   │   │   └── TPS.ts             #   TPS 监控
│   │   ├── gui/                   # 表单界面
│   │   │   ├── ChatGUI.ts         #   频道/私聊/红包 GUI
│   │   │   ├── CoopGUI.ts         #   合作社 GUI
│   │   │   ├── DpEditor.ts        #   动态属性编辑器
│   │   │   ├── FormShop.ts        #   旧表单商店
│   │   │   ├── LandGUI.ts         #   领土 GUI
│   │   │   ├── MainMenu.ts        #   主菜单
│   │   │   ├── MoneyGUI.ts        #   金钱指令 GUI
│   │   │   └── ShopGUI.ts         #   新箱子商店 GUI
│   │   ├── land/                  # 领土系统
│   │   │   ├── LandAPI.ts         #   领地 API
│   │   │   ├── LandCore.ts        #   领地核心
│   │   │   ├── LandDatabase.ts    #   数据持久化
│   │   │   ├── LandEvents.ts      #   事件处理
│   │   │   └── LandSystem.ts      #   系统初始化
│   │   ├── libs/                  # 工具库
│   │   │   ├── Command.ts         #   命令注册
│   │   │   ├── Gui.ts             #   表单工具
│   │   │   ├── HttpDB.ts          #   数据库 HTTP 客户端
│   │   │   ├── Money.ts           #   计分板金钱
│   │   │   ├── Permission.ts      #   权限管理
│   │   │   └── Tools.ts           #   通用工具函数
│   │   ├── shop/                  # 箱子商店
│   │   │   └── ShopSystem.ts      #   商店核心逻辑
│   │   ├── shit/                  # 娱乐
│   │   │   └── ShitMountain.ts
│   │   ├── temp/
│   │   │   └── ChatSoundsHelper.ts # 聊天音效
│   │   ├── entry.ts               # 模组初始化入口
│   │   └── main.ts                # 启动文件
│   ├── behavior_packs/            # 行为包
│   ├── resource_packs/            # 资源包
│   ├── just.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── .prettierrc.json
│   ├── .env                       # 部署路径配置
│   └── package.json
└── README.md
```

---

## 数据存储

所有持久化数据使用 `world.setDynamicProperty` 存储。(废弃中……)

### 商店

| Key | 数据 |
| --- | --- |
| `shop:price_data` | 商品价格数据 |

### 合作社

| Key | 数据 |
| --- | --- |
| `coop:teams` | 合作社数据 |
| `coop:player_teams` | 玩家 - 合作社映射 |

### 土地

| Key | 数据 |
| --- | --- |
| `land:registry` | 领地注册数据 |
| `land:player_lands` | 玩家 - 领地映射 |

### 其他

| Key | 数据 |
| --- | --- |
| `invswitcher:next_index` | 背包切换下一个可用箱子索引 |
| `invswitcher:player_<xuid>` | 玩家背包箱子索引 |
| `DOGE_CLEAN_INDEX` | 清理系统当前回收箱索引 |

---

## 外部数据库服务（db-server）

在行为包之外，项目包含一个独立的 **Node.js HTTP 服务**，使用 SQLite (sql.js) 提供 REST API 数据持久化。

### 启动方式

```bash
cd db-server
node index.js
# 默认端口 3001，可通过环境变量 DB_PORT 修改
```

### REST API 总览

#### 消息与红包（DogeChat）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/messages/save` | 保存消息 |
| `GET` | `/api/messages/:channelId` | 查询频道消息（支持 `?cutoff=` 时间戳过滤） |
| `DELETE` | `/api/messages/:channelId` | 删除频道消息 |
| `POST` | `/api/messages/cleanup` | 批量清理过期消息 |
| `POST` | `/api/redpackets/save` | 保存红包 |
| `POST` | `/api/redpackets/update` | 更新红包 |
| `GET` | `/api/redpackets` | 获取有效红包列表 |
| `GET` | `/api/redpackets/:id` | 获取单个红包 |
| `POST` | `/api/cleanup-expired-rp` | 清理过期红包 |

#### 计分板同步（sfmc）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/sfmc/scoreboards/sync` | 全量同步覆盖计分板数据 |
| `GET` | `/api/sfmc/scoreboards` | 查询计分板（支持 `?objective=&name=&xuid=` 过滤） |
| `GET` | `/api/sfmc/scoreboards/objectives` | 列出所有记分项 |
| `DELETE` | `/api/sfmc/scoreboards` | 清空计分板数据 |

#### 行为日志（sfmc）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/sfmc/activities/batch` | 批量写入行为日志 |
| `GET` | `/api/sfmc/activities` | 查询日志（支持 `?xuid=&event=&from=&to=&name=&limit=&offset=`） |
| `GET` | `/api/sfmc/activities/stats` | 统计（`?xuid=&from=&to=`） |
| `POST` | `/api/sfmc/activities/cleanup` | 按保留策略清理过期数据 |

#### 通用 KV 存储（废弃中……）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/kv/:key` | 读取 KV |
| `POST` | `/api/kv/save` | 写入 KV |
| `DELETE` | `/api/kv/:key` | 删除 KV |
| `GET` | `/api/kv` | 获取所有 KV 键值对 |

#### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |

### 数据库表

| 表名 | 说明 | 存储方式 |
|------|------|----------|
| `sfmc_chat_messages` | 聊天消息 | 结构化列 |
| `sfmc_chat_redpackets` | 红包数据 | 结构化列 |
| `kv_store` | 通用 KV | key-value（废弃中……） |
| `sfmc_scoreboards` | 计分板同步 | 结构化列（细分存储） |
| `sfmc_activities` | 行为日志 | 结构化列（细分存储） |

---

## 计分板同步模块（ScoreboardSync）

### 概述

定时将 Minecraft 游戏内的全部计分板数据同步至外部 SQLite 数据库，并支持从数据库恢复到游戏。

### 架构

```
游戏计分板 (SAPI)
    │
    ├── sync() ──→ 遍历 objectives + getScores()
    │                  │
    │                  ▼
    │           POST /api/sfmc/scoreboards/sync
    │                  │
    │                  ▼
    │           SQLite: DELETE + INSERT batch（事务）
    │
    └── load() ←── GET /api/sfmc/scoreboards
                       │
                       ▼
                 遍历 entries → xuid 匹配 → name 
                       │
                       ▼
                  objective.setScore() 写回游戏
```

### 表结构（sfmc_scoreboards）

```sql
CREATE TABLE sfmc_scoreboards (
  objective_id      TEXT NOT NULL,      -- 记分项 ID（如 "money"）
  objective_display TEXT NOT NULL,      -- 记分项显示名称
  participant_id    INTEGER NOT NULL,   -- 计分板内部数字 ID
  participant_type  TEXT NOT NULL,      -- "Player" | "FakePlayer" | "Entity"
  participant_name  TEXT NOT NULL,      -- 参与者显示名
  xuid              TEXT DEFAULT '',    -- 玩家 XUID（Player 类型时）
  score             INTEGER NOT NULL,   -- 分数值
  updated_at        INTEGER NOT NULL,   -- 同步时间戳
  PRIMARY KEY (objective_id, participant_id, participant_type)
);
```

**索引：**
- `idx_sfmc_sb_participant` — `(participant_type, xuid)` 玩家查询加速
- `idx_sfmc_sb_updated` — `(updated_at)` 时间范围查询

### 命令

| 命令 | 权限 | 说明 |
|------|------|------|
| `!sbs` | OP | 手动触发计分板同步 |
| `!sbs_load` | OP | 从数据库恢复计分板到游戏 |

### 自动同步

系统每 **5 分钟** 自动执行一次全量同步，无需人工干预。

### 恢复策略

1. **Player 类型**：优先通过 `xuid` 匹配在线玩家 → 使用 `ScoreboardIdentity` 设置分数
2. **Player 类型（离线）**：使用玩家名字符串 fallback（`objective.setScore(name, score)`）
3. **FakePlayer / Entity 类型**：直接用参与者名称字符串设置

---

## 行为日志（ActivityLog）

### 概述

自动订阅原版游戏事件，记录玩家行为到 `sfmc_activities` 表，支持追溯查询与统计分析。

**设计原则：**
- 只记录**原版行为**，不记录模组内部事件
- 以**玩家为主体**，凭借 XUID 即可追溯其全部行为轨迹
- 高频事件（方块破坏、战斗等）通过 **队列 + 2 秒批量 flush** 节流
- 可通过 `ENABLED_EVENTS` 配置开关每种事件类型

### 表结构（sfmc_activities）

```sql
CREATE TABLE sfmc_activities (
  id              TEXT PRIMARY KEY,
  timestamp       INTEGER NOT NULL,       -- 事件时间（Unix 毫秒）
  dimension       TEXT NOT NULL DEFAULT '',-- 维度

  source_type     TEXT NOT NULL,          -- "player" | "entity" | "world"
  source_xuid     TEXT DEFAULT '',        -- 玩家 Entity.id（唯一标识，跨存档不变）
  source_name     TEXT NOT NULL,          -- 玩家名 / 实体类型
  source_x/y/z    REAL,                  -- 来源坐标

  event_type      TEXT NOT NULL,          -- 事件类型（命名空间.行为）

  target_type     TEXT DEFAULT '',        -- "player" | "entity" | "block" | "item" | ""
  target_xuid     TEXT DEFAULT '',        -- 目标玩家 XUID
  target_name     TEXT DEFAULT '',        -- 目标名 / 方块ID / 物品ID
  target_x/y/z    REAL,                  -- 目标坐标

  detail          TEXT DEFAULT '{}',      -- 事件专属 JSON 数据
  created_at      INTEGER NOT NULL
);
```

**索引：**
- `idx_sfmc_act_source` — `(source_xuid, timestamp)` 按玩家查
- `idx_sfmc_act_event` — `(event_type, timestamp)` 按事件类型查
- `idx_sfmc_act_time` — `(timestamp)` 按时间范围查
- `idx_sfmc_act_target` — `(target_xuid, event_type)` 按目标查

### 记录的事件类型

| 事件 | event_type | 触发条件 | detail 内容 |
|------|-----------|---------|------------|
| 玩家加入 | `player.join` | 玩家进服（首次生成） | `{}` |
| 玩家离开 | `player.leave` | 玩家退出 | `{playerId}` |
| 玩家重生 | `player.spawn` | 死亡后重生 | `{}` |
| 维度切换 | `player.dimension` | 跨维度传送 | `{from, to, fromLoc, toLoc}` |
| 游戏模式切换 | `player.gamemode` | 切换创造/生存等 | `{from, to}` |
| 聊天 | `player.chat` | 发送聊天消息 | `{message, targets?}` |
| 破坏方块 | `block.break` | 玩家破坏方块 | `{itemBefore?, itemAfter?}` |
| 放置方块 | `block.place` | 玩家放置方块 | `{}` |
| 击杀（玩家/生物） | `entity.death` | 实体死亡 | `{cause, projectile?}` |
| 攻击 | `entity.hit` | 近战命中 | `{}` |
| 受伤 | `entity.hurt` | 玩家受到伤害 | `{damage, cause, damager?}` |
| 交互实体 | `entity.interact` | 与实体交互（交易等） | `{item?}` |
| 驯服 | `entity.tame` | 驯服生物 | `{}` |
| 生物生成 | `entity.spawn` | 生物自然/刷怪生成 | `{cause}` |
| 掉落物品 | `item.drop` | 丢弃物品 | `{items[]}` |
| 拾取物品 | `item.pickup` | 拾取物品 | `{items[]}` |
| 打开容器 | `container.open` | 打开箱子/漏斗等 | `{}` |
| 关闭容器 | `container.close` | 关闭容器 | `{}` |
| 爆炸 | `world.explosion` | 苦力怕/TNT 爆炸 | `{impactedBlocks}` |

### 节流机制

```
事件触发 → 入内存队列
              ↓
        每隔 2 秒批量 flush
              ↓
    POST /api/sfmc/activities/batch
              ↓
    SQLite 事务批量 INSERT
```

所有事件类型共用同一个队列，每 2 秒一次性提交到 db-server，避免高频事件产生大量 HTTP 请求。

### 保留策略

- **常规事件**（`player.*`, `block.*`, `entity.*`, `item.*`, `container.*`, `world.*`）：保留 **30 天**
- **管理事件**（`admin.*`）：**永久保留**
- 每 **6 小时** 自动执行一次清理

### 查询示例

```bash
# 查某玩家最近的行为
GET /api/sfmc/activities?xuid=1234567890&limit=50

# 查某玩家最近破坏了哪些方块
GET /api/sfmc/activities?xuid=1234567890&event=block.break&limit=100

# 查某段时间内的 PvP 击杀
GET /api/sfmc/activities?event=entity.death&from=1720000000000&to=1720100000000

# 统计某玩家各事件类型数量
GET /api/sfmc/activities/stats?xuid=1234567890
```

### 配置开关

在 `ActivityLog.ts` 中可通过 `ENABLED_EVENTS` Set 控制每种事件类型的开关。默认全部开启。

---

## 游戏内信息格式规范

### 1. 消息发送（Msg）

当插件向玩家发送聊天消息时，必须使用 `libs/Tools.ts` 中定义的 `Msg` 对象，按消息类型分类：

| 函数 | 前缀 | 用途 |
| --- | --- | --- |
| `Msg.info(text, player)` | `§f[*]` | 普通信息 |
| `Msg.success(text, player)` | `§a[√]` | 成功 |
| `Msg.error(text, player)` | `§c[x]` | 失败 |
| `Msg.warning(text, player)` | `§e[!]` | 警告 |
| `Msg.tips(text, player)` | `§7[!]` | 提示 |

- 消息文本末尾在合适位置加句号。
- 消息文本中不使用自定义前缀（前缀由 `Msg.*` 自动添加）。

### 2. 表单 body（ListFormInfo）

所有表单 body 必须通过 `ListFormInfo(string[])` 函数构建：

```typescript
const body = [
  `第一行信息（会被加上 [*] 前缀）`,
  `  第二行信息（缩进）`,
  `  第三行`,
];
form.body(ListFormInfo(body));
// 输出:
// [*] 第一行信息
//   第二行信息
//   第三行
//
// §7请选择操作：
```

- `ListFormInfo([])` 仅返回 `§7请选择操作：`，适用于无需额外信息的表单。
- 在合适位置加句号。

### 3. 按钮格式

- 所有按钮文字**不加格式字符**（如 `§6`、`§f`、`§a` 等）。
- 仅底部导航用的 **"返回"** 按钮使用 `§l` 加粗：`§l返回`。

### 4. 表单标题

表单 `.title()` 中的标题文本**不加格式字符**。

### 5. 列表信息格式

长文本列表的格式如下（标签用 `§7`，值用 `§r` 接普通文本）：

```txt
土地信息：
  - §7- 土地名称: §r土地名§7(编号)
  - §7- 拥有者: §r拥有者名
  - §7- 面积: §r 100 §7格 | - 体积: §r 1000 §7格
```

---

## TODO

- 坐下
- Addon 移除助手
- 自动区块加载
- 末影箱取消
- 通过脚本设置玩家权限
