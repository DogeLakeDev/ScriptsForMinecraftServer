# LANDGUI 重设计与实施方案

## 目标

将土地 GUI 重构为以日常使用为中心的 DDUI 工作台，使用 `@minecraft/server-ui` 的 `CustomForm`、`MessageBox` 和项目封装的 `MenuNavigator`。

核心目标：易用、舒适、快捷、方便、美观，并让所有写操作遵守服务端权限和经济事务。

## DDUI 约束

- `CustomForm` 用于多区块信息、编辑和导航。
- 使用 `ObservableString`、`ObservableBoolean`、`ObservableNumber` 实现余额、状态、按钮可见性和表单控件实时更新。
- `MessageBox` 仅用于购买、转让、删除等危险操作的二次确认。
- 所有表单处理 `UserBusy`、玩家主动关闭、服务端关闭和异常情况。
- 所有异步写操作显示进行中状态，防止重复提交，成功后刷新缓存，失败后保留当前输入。
- 使用 `MenuNavigator` 管理 section、返回历史、刷新和离开流程。

## 权限矩阵

| 操作 | Owner | Admin | 其他角色 |
| --- | --- | --- | --- |
| 修改土地名称 | 是 | 是 | 否 |
| 修改访客保护 | 是 | 是 | 否 |
| 邀请普通角色 | 是 | 是 | 否 |
| 移除普通成员 | 是 | 是 | 否 |
| 调整普通成员角色 | 是 | 是 | 否 |
| 邀请或调整 Admin | 是 | 否 | 否 |
| 移除 Admin | 是 | 否 | 否 |
| 转让土地 | 是 | 否 | 否 |
| 删除土地 | 是 | 否 | 否 |

GUI 隐藏按钮不构成安全边界，db-server 必须执行同样的权限矩阵。

## 信息架构

```text
土地中心
├─ 当前土地
│  └─ 土地概览
├─ 我的土地
│  └─ 土地详情
│     ├─ 成员与邀请
│     ├─ 访客保护
│     ├─ 基本信息
│     └─ 所有权与风险
├─ 土地申请
│  ├─ 选点进度
│  └─ 购买确认
└─ 收到的邀请
   └─ 邀请详情 / 接受 / 拒绝
```

## 页面设计

### 土地中心

首页显示当前所在地、玩家角色、拥有土地数量、申请状态和待处理邀请。

高频入口应支持两次点击内完成：查看当前位置土地、继续申请、查看自己的土地、接受邀请。

### 当前土地与详情

所有角色可以查看土地名、所有者、角色、维度、范围、面积和版本。只有拥有相应能力时显示成员、保护、基本信息或所有权入口。

### 我的土地

只列出玩家拥有的土地，显示土地名、维度、面积和成员数。顶部显示 `拥有数量 / 上限`。空状态提供申请入口。

### 成员与邀请

按 Owner、Admin、普通成员、待处理邀请分组。普通角色使用下拉框调整，Admin 的邀请、调整和移除只对 Owner 显示。成员操作全部调用服务端邀请/成员 API，不直接修改本地列表。

### 访客保护

默认显示场景化设置：建造、容器、门和按钮、红石、实体交互、实体攻击、拾取物品。高级设置显示底层能力。保存时提交操作者身份，接收服务端最新土地和版本。

### 基本信息

仅编辑土地名称。范围、维度、创建时间只读。名称由服务端校验并写审计日志。

### 所有权与风险

仅 Owner 显示转让和删除。转让、删除使用 `MessageBox` 二次确认，退款使用服务端实际结果，禁止使用本地预估作为最终结果。

### 土地申请

保留 `!pos1` 和 `!pos2` 精确选点。GUI 展示两点状态、范围、面积、预估价格、当前余额和购买后余额。确认购买时重新加载余额，并以服务端返回的实际价格和土地为准。

## MenuNavigator 改造

- `refresh()`：重建当前 section，不增加历史。
- `replace(sectionId)`：替换当前历史节点，避免回到过期表单。
- `runTask()`：统一进行中状态、重复提交保护、异常处理和结果刷新。
- `confirmMessage()`：封装 `MessageBox` 的确认/取消结果。
- 统一处理 DDUI 关闭原因和 `UserBusy` 重试。
- 不再用动态 confirm section 承载危险操作。

## 状态模型

```ts
type LandGuiState = {
  selectedLandId?: string;
  application?: { pos1?: LandPos; pos2?: LandPos; dimensionId?: number };
  invites: LandInvite[];
  loading: boolean;
  error?: string;
};
```

土地详情通过 `selectedLandId` 从缓存读取。写操作成功后用服务器返回值更新缓存，不能长期依赖旧的 `nav.state.land` 对象。

## API 待办

```text
PATCH  /api/sfmc/lands/:id/members/:playerId
POST   /api/sfmc/lands/invites/:playerId/decline
DELETE /api/sfmc/lands/:id/invites/:inviteId
```

成员角色更新必须禁止修改或移除 Owner，并根据 Owner/Admin 身份执行矩阵权限检查。

## 实施顺序

- [x] 增强 `MenuNavigator` 的刷新、替换、异步任务和 MessageBox 确认能力。
- [x] 补齐成员角色更新、邀请拒绝、邀请撤销 API 和服务端权限矩阵。
- [x] 重写首页、当前土地和我的土地列表。
- [x] 重写土地详情、成员与邀请、访客保护、基本信息和所有权风险页面。
- [x] 重写申请流程和服务端经济结果展示。
- [x] 删除旧 `managerEditor`、`addManager`、`removeManager` 和旧权限页面。
- [x] 完成构建和 API 回归；Bedrock 客户端手动验证待实际服务器环境执行。

## 当前进度

- [x] 设计方案确认。
- [x] Owner 只能转让、删除土地和调整 Admin 角色的权限决策确认。
- [x] 代码实现。
- [x] 验证和文档收尾（客户端手动验证保留为后续运行项）。
