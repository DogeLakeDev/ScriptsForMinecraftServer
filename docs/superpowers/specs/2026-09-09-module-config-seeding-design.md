# 模块默认配置播种设计

## 目标

模块在安装、更新或本地链接后，SFMC 应根据模块随包携带的默认配置，在工作目录的 `configs/<configKey>.json` 中创建可立即编辑的模块配置。已存在的服主配置不得被默认值覆盖。

## 非目标

- 不让 SAPI 模块通过 `config.set()` 自行播种默认值。
- 不在本期引入配置版本号、字段重命名或删除迁移。
- 不覆盖、清理或重排用户已有配置。
- 不将模块私有配置并入平台启动快照。

## 已选决策

### 唯一默认配置约定

模块包内的标准路径为：

```text
configs-default/<configKey>.json
```

选择该路径是因为现有业务模块已普遍使用它，可避免再引入 `config.default.json` 等竞争格式。`manifest.configKey` 仍是目标文件名和配置命名空间的权威来源。

### 执行边界

默认配置播种由 CLI 安装流程负责，并统一从 `afterInstall` 路径调用。因此 npm、tgz/zip、dir 和 link 安装源共享同样的行为。

`afterInstall` 内必须先完成默认配置验证与播种，再更新 catalog 和 module lock。若配置验证或写入失败，不得将该模块标记为已安装或已启用。

安装器具有 SFMC 工作目录的管理权限，因此创建配置文件不要求模块声明 `config:write:<configKey>`。模块运行时仍按 manifest 权限读写配置。

### 合并语义

安装或更新时，将默认配置递归补入目标配置：

- 目标不存在：写入完整默认配置。
- 目标已存在：仅补充缺失字段。
- 对象：递归处理缺失字段。
- 数组和标量：视为完整值；若目标已有该键则不合并、不覆盖。
- 未知用户字段：原样保留。
- 默认配置中的 `$schema` 按普通默认字段处理；已存在时不改写。

该语义使新版模块可以补入新增字段，同时保证用户设定不会因重装或升级被重置。

### 失败与安全规则

- `configKey` 必须符合现有安全标识符规则。
- 默认文件的文件名必须等于 `<configKey>.json`。
- 默认配置和已有配置都必须是 JSON 对象，不接受数组或标量顶层。
- 已有配置 JSON 损坏时，安装或更新必须失败并保留原文件，不得以默认值覆盖。
- 写入应使用临时文件加原子替换，避免中途中断留下半份 JSON。
- 从模块包解析的源路径和目标路径必须位于各自预期根目录内，不允许路径穿越。

### 无默认配置的兼容性

`configKey` 仍为 manifest v2 必填字段，但旧模块可能没有 `configs-default/<configKey>.json`。本期保持向后兼容：

- 安装器记录“未提供默认配置”，但不因此拒绝安装。
- `check-modules` 对缺失默认配置给出警告，对文件存在但名称或 JSON 结构错误给出硬错误。
- 模块仍可通过代码内 fallback 默认值运行。

## 数据流

```text
sapi/manifest.json
  └─ configKey
configs-default/<configKey>.json
  └─ 模块默认值
          │
          ▼ sfmc mod install/update/link
configs/<configKey>.json
  └─ 服主可编辑的持久化配置
```

`db-server` 和 SAPI `config.get/set` 继续只读写最后的工作目录配置，不在运行时读取 `configs-default` 目录。

## 文件与模块边界

### CLI 安装器

- `packages/cli/scripts/module-install/fetch-module.mjs`
  - 在 `afterInstall` 中、catalog/lock 更新之前执行配置验证和播种。
  - 确保 npm、压缩包、目录和 link 来源行为一致。
  - 输出 `created`、`updated`、`unchanged` 或 `missing defaults` 结果。
- `packages/cli/scripts/module-install/lib/`
  - 放置可单测的路径校验、JSON 解析和递归补缺逻辑，避免继续膨胀 `fetch-module.mjs`。
- `packages/cli/scripts/module-install/check-modules.mjs`
  - 检查 manifest、`configKey` 与默认配置的一致性。

### 模块脚手架

- `packages/create-module/templates/base/configs-default/{{configKey}}.json`
  - 新模块默认生成空 JSON 对象。
- `packages/create-module/templates/base/package.json`
  - `files` 列表加入 `configs-default`。
- `packages/create-module/src/create-module.ts`
  - 确保模板文件名可使用 `configKey` 渲染。

### ESLint 与静态检查

- `modules/sdk/@sfmc-eslint-plugin/src/utils/config-fields.ts`
  - 优先读取标准路径 `configs-default/<configKey>.json`。
  - 保留旧候选路径作为过渡兼容，但文档和脚手架不再生成旧格式。

### 文档

- 更新中英文配置指南和模块作者文档。
- 将“默认值由模块首次写入提供”修正为“安装时从 `configs-default` 播种，运行时仅读写工作目录配置”。

### Changeset

CLI、`create-module` 和 ESLint 插件均为可发布包，实施时应添加对应 patch changeset。

## 用户可见输出

```text
[fetch-module] config created: configs/data_backup.json
[fetch-module] config updated: added scoreboard.ignore_objectives
[fetch-module] config unchanged: configs/data_backup.json
[fetch-module] config defaults missing: data_backup
```

当补入多个字段时，`updated` 日志应输出稳定排序的点路径列表，便于测试和用户核对。

## 验收标准

1. 安装带默认配置的模块后，`configs/<configKey>.json` 立即存在，无需启动 BDS 或调用 `config.set()`。
2. npm、tgz/zip、dir 和 link 四种来源的播种结果一致。
3. 重复安装不会改写任何用户已有值。
4. 模块更新后，新增的对象字段会递归补入，已有标量和数组保持不变。
5. 用户配置 JSON 损坏时操作失败、原文件字节不变，并输出可定位的错误。
6. 新生成模块的 npm 包包含 `configs-default/<configKey>.json`。
7. `valid-config-key` 能从标准路径读取默认字段并检查 `config.get/set` 调用。
8. 无默认配置的旧模块仍可安装，但会得到明确警告。
9. 安装器单测覆盖创建、不变、递归补缺、损坏 JSON、路径拒绝和旧模块兼容。
10. 相关 CLI、`create-module` 和 ESLint 测试、类型检查及构建全部通过。

## 明确延后

- 配置 schema 的模块级标准分发与 `$schema` 自动注入。
- 配置版本和显式迁移脚本。
- 自动删除废弃字段或自动重命名。
- 为现有已安装模块提供独立的批量配置修复命令；本期通过重新安装或更新触发播种。
