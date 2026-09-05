# fly-area — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 作为挂接在 `area` 空间引擎上的声明式特性组件（`fly`），为进入指定空间区域的生存模式玩家赋予临时飞行许可（`mayfly`），并在离开区域时平稳撤销飞行并施加短时缓降（Slow Falling）安全缓冲，杜绝玩家因边界撤销飞行导致的高空摔伤；提供平滑无感知的区域飞行体验。

**Non-goals:**
- 不自建独立空间边界检测逻辑，完全接入上游 `area` 空间插槽
- 不提供面向全图或付费买飞的全局飞行管理（该能力由其它专属插件承载）
- 严禁向外部导出内部实现类

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `fly-area` |
| npm | `@sfmc-bds/module-fly-area` |
| manifest.id | `fly-area` |
| configKey | `fly_area` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["area"]` |

## 3. Player surface

纯空间插槽驱动，无面向普通玩家的交互命令。

登记权限节点：

| 权限节点 | 权限等级 | 行为摘要 |
|----------|----------|----------|
| `fly_area.use` | Any (0) | 飞行能力标记（进入飞行区域时由系统动态赋予） |

## 4. Data

纯内存维护当前处于飞行赋权状态的在线玩家集合，无数据库持久化表。

## 5. Config

`configs/fly_area.json`：

```json
{
  "slow_falling_duration_ticks": 100,
  "slow_falling_amplifier": 0,
  "actionbar_notify": true
}
```

- `slow_falling_duration_ticks`：离开飞行区域时赋予的缓降效果时长（默认 100 ticks / 5秒），确保悬空玩家平稳落地；
- `slow_falling_amplifier`：缓降效果等级（默认 0）；
- `actionbar_notify`：是否在玩家进出飞行区时于 actionbar 显示状态提示。

## 6. Services

### provides

无。

### requires

| name | 来自 | 用途 |
|------|------|------|
| `area.registerFeature` | [area-design.md](./area-design.md) | 向底层空间引擎注册 `fly` 特性生命周期处理器 |

## 7. Lifecycle notes

- `afterWorldLoad`: **true**
- `registerEvents`：调用 `area.registerFeature` 挂接 `fly` 特性生命周期处理器：
  - **`onEnter(player, ctx, params)`**：
    - 若玩家处于生存模式，动态开启原生飞行能力（`mayfly: true`）并登记 `fly_area.use` 临时标记；
    - 若配置开启 `actionbar_notify`，显示入区飞行提示。
  - **`onLeave(player, ctx, params)`**：
    - 若玩家具有 `fly_area.use` 标记，立即关闭 `mayfly` 飞行能力；
    - 若离开时玩家处于悬空滞空状态，自动施加指定时长的 `minecraft:slow_falling` 缓降效果，防止跌落暴毙；
    - 若配置开启 `actionbar_notify`，显示离区缓降提示。
- 玩家下线保障：依赖 `area` 引擎派发的下线退出清算，安全移除临时飞行状态，杜绝卡出区域离线带飞。

## 8. Acceptance criteria

- [ ] 成功调用 `area.registerFeature` 挂接 `fly` 特性
- [ ] 生存模式玩家进入声明 `features.fly` 的区域自动获得飞行能力
- [ ] 离开飞行区时立即取消飞行能力，悬空玩家获得缓降保护且无摔伤
- [ ] 离开区域及下线重登无残留飞行能力漏洞
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 区分创造模式/生存模式单独配置允许飞行白名单

## 10. Legacy reference（仅参考）

- `packages/area/`（原 fly 子能力抽离重构）
