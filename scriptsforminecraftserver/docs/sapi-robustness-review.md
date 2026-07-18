# SAPI 脚本健壮性审查报告

> 审查日期：2026-07-15
> 范围：`scriptsforminecraftserver/scripts/` 全量 TypeScript

---

## P0 — 必须修复 ✅ 全部完成

### ~~1. `LandDatabase.ts:425` — 未加载时静默返回空数据~~

```ts
private static ensureLoaded(): void {
  if (!this._registry) this._registry = new Map();
  if (!this._ownerIndex) this._ownerIndex = new Map();
}
```

在 `loadFromServer()` 完成之前，`getAt()`、`getById()`、`getByOwner()` 全返回空结果而非阻塞等待。影响：启动窗口期内所有领地保护检查走 `getLandByPos → Database.getAt → undefined → canUseAt 返回 true（无领地 → 允许）`，玩家可绕过领地保护。

**状态：✅ 已修复** — `ensureLoaded()` 在 `_loading` 进行中时不再创建空 map，与 `hasAuthoritativeSnapshot()` 的 false 状态保持一致，启动窗口期保护路径统一拦截。

### ~~2. `LandPolicy.ts:56` — 无权威快照时全部拦截~~

```ts
if (!Database.hasAuthoritativeSnapshot()) return false;
```

启动期间 `hasAuthoritativeSnapshot = false` → `canUseAt()` 对所有玩家返回 false（拦截全部操作）。这个行为和 `ensureLoaded()` 的空 map 产生冲突时间窗口。

**状态：✅ 已修复** — 已与 #1 对齐：`ensureLoaded()` 不再提前创建空 map，`hasAuthoritativeSnapshot` 的 false 状态是唯一的启动期守卫，不再存在互斥逻辑。

### ~~3. `CoopCore.ts:357,386` — `runCommand` 玩家名注入~~

```ts
player.runCommand(`give "${player.name}" ...`);
player.runCommand(`clear "${player.name}" ...`);
```

`Tools.ts:73` 有 `playerCMDName()` 处理空格/特殊字符，但这里没引用。MC 玩家名允许 `"`、`"` 等字符可打破引号包裹。

**状态：✅ 已修复** — 将 `"${player.name}"` 替换为 `@s`，完全消除名注入向量。

### ~~4. `LandGUI.ts:597-598` — 转让土地自动选第一个在线玩家~~

```ts
const target = world.getPlayers().find((p) => p.id !== this.player.id);
```

不是让用户选目标，而是直接取第一个非自己的在线玩家。

**状态：✅ 已修复** — 改为从在线玩家列表 dropdown 选择目标，复用 `buildInvite` 已有的 player selector 模式。

---

## P1 — 应修复 ✅ 全部完成

### ~~5. 维度 ID 映射重复 6+ 处~~ ✅

`LandEvents.ts`、`LandSystem.ts`、`LandGUI.ts` 共 12 处重复已全部替换为 `libs/Tools.ts` 的 `dimensionId()` 公共函数。

**状态：✅ 已修复** — 新增 `libs/Tools.ts:dimensionId(dimension)`，12 处调用全部替换，本地函数已删除。

### ~~6. `Money.ts:72` — 余额 fallback 可能不同步~~ ✅

```ts
this.setCached(player, result.balance ?? this.get(player) + money, result.version);
```

**状态：✅ 已修复** — `result.balance` 存在时直接写缓存，缺失时删除缓存条目强制下次 `load()` 从服务端拉取，消除本地计算的不同步风险。

### ~~7. `HttpDB.ts:96` — `(req as any).method = method` 脆性类型断言~~ ✅

**状态：✅ 已修复** — 改用 `HttpRequestMethod` 枚举 + `req.method = method` 类型安全赋值，移除 `as any`。

### ~~8. `ConfigManager.ts:233-247` — HTTP 失败时静默使用过期缓存~~ ✅

所有 `_fetch*` 9 个方法在 `HttpDB.get()` 返回空时通过 `_recordError()` 标记 `_configStale = true`，stale 状态不再被静默忽略。

**状态：✅ 已修复** — 9 个 `_fetch*` 方法全部补上 `_recordError` 调用。

---

## P2 — 建议改进 ✅ 全部完成

### ~~9. `DebugLog.ts:30` — log 格式括号缺失~~ ✅

```ts
console.log(`[${ts()}][${level}][${module}] ${msg}${extra}`);
```

**状态：✅ 已修复** — 补上 `ts()` 后缺失的 `]`。

### ~~10. 幂等键碰撞空间有限~~ ✅

36^6 → 36^8，碰撞空间从 2.1B 扩大到 2.8T。所有 7 处 `slice(2, 6/8)` 统一为 `slice(2, 10)`。

**状态：✅ 已修复** — 7 处（LandCore/LandGUI/CoopGUI/CoopCore/defaults/Database）统一更新。

### ~~11. `LandEvents.ts:207` — 边界扫描间隔~~ ✅

```ts
system.runInterval(() => this.scanPlayerBoundaries(), 40);
```

**状态：✅ 已修复** — 20 → 40 tick（2 秒），降低 `world.getPlayers()` 调用频率。

### ~~12. `Money.ts:50` — `set()` 增强弃用警告~~ ✅

**状态：✅ 已修复** — 入口处加 `console.warn` + `new Error().stack` 调用栈追踪，帮助定位仍在使用 `set()` 的调用方。

---

## 修复记录

| 编号 | 描述 | 状态 | 日期 |
|------|------|------|------|
| #1 | `ensureLoaded` 启动窗口 | ✅ 已修复 | 2026-07-15 |
| #2 | `hasAuthoritativeSnapshot` 与空 map 冲突 | ✅ 已修复 | 2026-07-15 |
| #3 | `runCommand` 玩家名注入 | ✅ 已修复 | 2026-07-15 |
| #4 | 转让土地自动选人 | ✅ 已修复 | 2026-07-15 |
| #5 | 维度 ID 重复 12 处 | ✅ 已修复 | 2026-07-15 |
| #6 | 余额 fallback 不同步 | ✅ 已修复 | 2026-07-15 |
| #7 | `(req as any).method` 脆性断言 | ✅ 已修复 | 2026-07-15 |
| #8 | HTTP 失败时缓存过期无标记 | ✅ 已修复 | 2026-07-15 |
| #9 | DebugLog 括号缺失 | ✅ 已修复 | 2026-07-15 |
| #10 | 幂等键碰撞空间 6→8 位 | ✅ 已修复 | 2026-07-15 |
| #11 | 边界扫描间隔 20→40 | ✅ 已修复 | 2026-07-15 |
| #12 | `set()` 弃用警告增强 | ✅ 已修复 | 2026-07-15 |
