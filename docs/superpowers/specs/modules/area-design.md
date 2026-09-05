# area — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 构建微内核空间引擎与**全平台空间拓扑与区域特性插槽提供者（Spatial Engine & Area Slot Provider）**。负责维护全服区域几何定义、空间网格索引、实体/玩家边界移动检测（`onEnter` / `onLeave`）与调度循环（`onTick`）；核心内部**零业务硬编码**，对外通过 `area.registerFeature` 提供统一的区域特性组件挂接插槽，并提供动态建区（`area.registerArea`）与点查服务，使官方特性（如生存/创造、飞行、清理、和平）及第三方扩展能以纯声明式方式组合与执行空间规则。

**Non-goals:**
- **核心模块内严禁内置具体业务逻辑**：诸如游戏模式切换、飞行赋权、掉落物回收、怪物过滤等业务能力全部剥离为独立的下游特性模块（`gamemode-area`、`fly-area`、`clean`、`peace-area`），本模块仅作为纯粹的空间与调度底座
- 首版几何判定统一采用指定维度内的 **XZ 平面轴对齐矩形（AABB）**，复杂三维多面体或体素级选区留待后续扩展
- 严禁向外部导出内部空间树或领域类，跨模块调用与特性注册严格经由标准化 **service** 调度

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `area` |
| npm | `@sfmc-bds/module-area` |
| manifest.id | `area` |
| configKey | `area` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `[]` |

## 3. Player surface

纯空间底座与调度中枢，无面向普通玩家的指令面。各具体区域特性若有交互命令（如 `!clean`），由对应的下游特性模块独立承载与注册。

## 4. Data

纯内存空间索引结构，无数据库持久化表。空间定义源自 `configs/area.json` 静态配置及运行时动态声明。

## 5. Config

`configs/area.json` 采用纯声明式的空间与特性挂载结构：

```json
{
  "scan_interval_ticks": 20,
  "areas": [
    {
      "name": "spawn_hub",
      "dimension": "minecraft:overworld",
      "start": [-64, -64],
      "end": [64, 64],
      "features": {
        "peace": {},
        "fly": {},
        "gamemode": { "mode": "survival", "enforce": true }
      }
    },
    {
      "name": "creative_park",
      "dimension": "minecraft:overworld",
      "start": [1000, 1000],
      "end": [1500, 1500],
      "features": {
        "gamemode": { "mode": "creative" }
      }
    }
  ]
}
```

- `scan_interval_ticks`：移动追踪与常驻调度的全局轮询周期（默认 20 ticks / 1秒）；
- `features` 字段采用**声明式参数字典**：键名对应已注册的特性 `featureId`（如 `peace`、`fly`、`gamemode`、`clean`），值为传递给特性处理器的私有参数对象；
- **解耦容错机制**：若某区域声明了特定 feature（例如 `fly`），但对应的业务模块未安装或被禁用，`area` 仅打印 debug 警告并正常放行其余特性，绝不阻断开服或空间索引。

## 6. Services

### 统一区域特性接口 (AreaFeatureHandler)

挂接在 `area` 上的特性模块需在 SAPI 进程内实现如下接口契约：

```ts
export interface AreaContext {
  readonly name: string;
  readonly dimension: string;
  readonly box: { minX: number; minZ: number; maxX: number; maxZ: number };
  readonly params: Record<string, unknown>;
}

export interface AreaFeatureHandler<TParams = Record<string, unknown>> {
  readonly id: string;
  onEnter?(player: Player, ctx: AreaContext, params: TParams): void;
  onLeave?(player: Player, ctx: AreaContext, params: TParams): void;
  onTick?(ctx: AreaContext, params: TParams): void;
}
```

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `area.registerFeature` | `{ id: string, handler: AreaFeatureHandler }` | `{ ok: boolean }` | **特性插槽注册**：下游模块（如 fly-area、gamemode-area）挂接生命周期处理器 |
| `area.registerArea` | `AreaDefinition` | `{ ok: boolean }` | **动态声明区域**：第三方模块在代码中动态创建自定义空间区域 |
| `area.unregisterArea` | `{ name: string }` | `{ ok: boolean }` | 销毁指定标识的动态区域 |
| `area.byName` | `{ name: string }` | `AreaDefinition \| null` | 按标识名检索区域定义与特性字典 |
| `area.byPoint` | `{ dimension: string, x: number, z: number, feature?: string }` | `AreaDefinition \| null` | 空间点查：检索命中坐标的区域，可选按包含指定 feature 过滤 |
| `area.listAreas` | `{ dimension?: string }` | `AreaDefinition[]` | 列出全部或指定维度内的区域清单 |

### requires

无。

## 7. Lifecycle notes

- `afterWorldLoad`: **true**（移动侦测与周期 tick 须在世界完全实装后激活）
- **边界状态机与生命周期派发**：
  1. 内部维护 `playerCurrentAreas: Map<playerId, Set<areaName>>`；
  2. 周期调度或位置变动时执行 AABB 包含校验：
     - 若玩家新进入某区域：触发该区域所有已注册特性的 `onEnter`；
     - 若玩家离开某区域：触发对应特性的 `onLeave`；
     - 玩家下线：对其实际身处的区域触发 `onLeave`，防止状态遗留（如创造/飞行残留）；
  3. 周期触发所有活动区域的 `onTick`，供周期性扫描类特性执行。

## 8. Acceptance criteria

- [ ] 核心零内置业务代码，所有空间规则完全通过 `AreaFeatureHandler` 插槽委托
- [ ] 边界进出判定准确，`onEnter`、`onLeave`、`onTick` 派发无误
- [ ] 玩家离线时正确触发离开清算，避免权限/模式泄漏
- [ ] 未安装特性的声明声明式平稳容错，不抛出异常
- [ ] provides 各项空间查询与插槽注册服务完整有效
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 三维 Y 轴高度裁剪、凸多边形空间索引与可视化选区工具

## 10. Legacy reference（仅参考）

- `packages/area/`（架构重构为微内核插槽底座）
