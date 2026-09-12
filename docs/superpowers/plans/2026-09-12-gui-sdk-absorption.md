# GUI 模块收编为平台 SDK 能力实施方案

> 状态：方案已确认，阶段 1 进行中
>
> 日期：2026-09-12

## 1. 结论

`sfmc-module-gui` 的声明式 UI Runtime、DDUI 映射、表单重试和 feature registry 属于平台宿主能力，最终统一进入 `@sfmc-bds/sdk/sapi/ui`。业务模块直接调用 SDK UI API，不再通过 `gui.*` 跨模块 service 间接访问。

所有启用模块与 SDK 会聚合进同一个 Behavior Pack `main.js`，因此 SDK 内的 registry 在运行时只有一个实例。UI 文档继续保持纯 JSON；业务动作仍调用模块 manifest 声明的命名 service。

## 2. 最终边界

| 当前内容 | 最终归属 |
| --- | --- |
| `declarative.ts` | SDK `sapi/ui` 声明式 Runtime |
| `forms.ts` | SDK UI 表单显示、繁忙重试和确认框 |
| `ddui-widgets.ts` | SDK UI 的 DDUI 映射 |
| `disabled-when.ts` | SDK UI 表达式和响应式禁用状态 |
| `nav-stack.ts` | SDK `sapi/runtime` 公共导航基础设施 |
| feature registry | SDK 宿主级全局 registry |
| `gui.registerFeature` 等 service | 迁移期兼容适配器，最终删除 |
| `/c:catalog` 与示例页面 | `sfmc-module-qa` 或 SDK 测试 fixture |
| `configs-default/gui.json` | 平台设置迁移来源；旧文件不自动删除 |
| `sfmc-module-gui` 包和模块目录 | 所有消费方迁移后退役 |

## 3. SDK API

业务模块通过 `@sfmc-bds/sdk/sapi/ui` 使用统一门面：

```ts
import { ui } from "@sfmc-bds/sdk/sapi/ui";

const unregister = ui.registerFeature({
  feature: featureUi,
  screens,
});

await ui.openScreen(player, {
  moduleId: "land",
  screenId: "land.home",
  params: {},
});

unregister();
```

注册函数必须执行共享 `compileUiProject`，不能在 Runtime 维护第二套文档校验。页面 load/action 根据 `feature.moduleId` 获取所属模块的 `ServiceClient`，避免借用 GUI 模块身份执行业务调用。

## 4. 迁移阶段

### 阶段 1：建立 SDK UI 能力面

- 新增 `@sfmc-bds/sdk/sapi/ui` 导出；
- 迁入声明式 Runtime、DDUI 映射、表单重试和 feature registry；
- 复用 SDK contract、validator、MenuNavigator 和 service client；
- 为 registry、导航语义、DDUI 映射和响应式状态增加测试；
- 不修改现有业务模块调用方式。

### 阶段 2：GUI 模块变为兼容适配器

- `sfmc-module-gui` 不再保存 Runtime 副本；
- `gui.registerFeature`、`gui.unregisterFeature`、`gui.listEntries`、`gui.openScreen` 临时转发到 SDK UI；
- `/c:catalog` 暂时保留，用于客户端目视验收；
- SDK beta 发布前不要求独立模块依赖未发布的子路径。

### 阶段 3：迁移消费模块

按 land、coop、online-time、chat 的顺序迁移：

- 改为直接导入 `@sfmc-bds/sdk/sapi/ui`；
- lifecycle init 注册 feature，cleanup 调用注销函数；
- 直接以 `Player` 打开页面；
- 删除 manifest 中 `service:gui.*` 权限与 requires；
- 每个模块执行自己的 typecheck/test，并检查 JSON 工程编译。

### 阶段 4：退役 GUI 模块

- 将控件目录迁到 `sfmc-module-qa`；
- 将繁忙重试配置迁入平台 settings，保留已有 `configs/gui.json`；
- 全仓确认没有 `gui.*` 调用或 manifest 引用；
- 删除 GUI 模块的市场记录、安装依赖和源码仓内容；
- 不提供长期旧 service 别名。

## 5. 发布与运行时验证

验证链必须按以下检查点分别记录：

1. SDK 源码：类型检查与 UI 定向测试；
2. SDK 构建产物：`dist/esm/sapi/ui/index.js` 与声明文件存在；
3. 聚合构建：最终 `main.js` 只包含一份 UI registry；
4. 部署包：世界中的 Behavior Pack 已替换；
5. BDS：启动日志无模块/service 注册错误；
6. 客户端：控件目录和至少一个真实业务页面完成打开、跳转、返回、提交和错误路径验收。

阶段完成不得跨越检查点推断。例如 SDK 测试通过不代表聚合包已经部署，也不代表 Minecraft 客户端验收完成。

## 6. 恢复策略

- 阶段 1 不改变业务模块调用，可直接停止迁移；
- 阶段 2 保留旧 service 适配层，消费模块可以逐个回退；
- 配置迁移只补入平台缺失字段，不覆盖用户值，不删除 `configs/gui.json`；
- 只有全部消费方和部署包扫描干净后才删除 `sfmc-module-gui`。

