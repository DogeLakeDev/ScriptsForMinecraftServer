# 发布你的模块

本文介绍如何将业务模块发布到 npm，并登记到社区索引 [`sfmc-modules`](https://github.com/Tanya7z/sfmc-modules)，以便服主通过 `sfmc mod search` 与 `sfmc mod install` 安装。

业务模块在各自独立的仓库中发布，不通过主仓的 Changesets 流水线（平台核心包 `@sfmc-bds/*` 的发版说明见文末附录）。

`sfmc mod publish` 历史命令已移除，请使用扩展命令 `SFMC: Publish to npm` 或直接执行 `pnpm publish`。

## 1. 发布前检查

| 检查项    | 要求说明                                                                         |
| :-------- | :------------------------------------------------------------------------------- |
| `private` | `package.json` 中的 `private` 不能为 `true`。                                    |
| `name`    | 社区模块使用 `@<scope>/sfmc-module-<id>`，官方模块使用 `@sfmc-bds/module-<id>`。 |
| `files`   | 必须包含 `sapi` 目录。                                                           |
| 静态检查  | 必须通过 `pnpm run typecheck` 与 `pnpm run lint`，并完成本地测试验证。           |
| 发布权限  | 确保已登录具备该 scope 发布权限的 npm 账号。                                     |

```bash
# 发布正式版本（公开包）
pnpm publish --access public

# 发布测试版本（dist-tag）
pnpm publish --tag beta
```

:::tip 版本说明
正式版默认发布到 npm 的 `latest` 标签；预发布版本建议指定 dist-tag（如 `@beta`）。
:::

## 2. 登记到社区索引

发布至 npm 后，在作者仓运行：

```bash
sfmc mod submit --dry-run
sfmc mod submit
# 也可以指定模块目录
sfmc mod submit ./my-module --dry-run
```

没有 CLI 时可安装 `@sfmc-bds/devkit`，使用 `sfmc-module-submit`；扩展提供 **SFMC: 提交到官方模块索引**，先打开 JSON 预览，再由作者选择提交。
提交需要 `gh auth login` 或 `GH_TOKEN`。有索引仓写权限时自动在索引仓建 PR 分支；其他作者自动 fork、创建分支并开 PR。相同内容不重复提交；首次收录及元数据调整使用 PR，后续版本由索引仓从 npm 自动同步。
`--no-fork` 可显式选择在目标索引仓建分支，需要该仓 Contents 和 Pull requests 写权限。提交路径不受账号名、仓库 owner 或模块 `official` 字段影响。

工具从 `package.json` 与 `sapi/manifest.json` 生成条目。SDK 范围来自 `peerDependencies.@sfmc-bds/sdk`，不能用开发依赖版本推断兼容性。
在 `sfmc.registry.json` 中补充展示信息即可：

```json
{
  "$schema": "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@main/packages/devkit/schemas/registry-author.schema.json",
  "name": "我的模块",
  "description": "模块提供的实际功能",
  "category": "utility",
  "tags": ["管理"],
  "authors": ["你的公开署名"]
}
```

配置只允许展示字段；ID、npm 包、版本、许可证、SDK 和依赖仍从契约读取。
更新已有模块时，未在作者配置中覆盖的名称、介绍及未指定的分类、标签、作者署名沿用索引内容，避免发版丢失已整理的展示信息。
工具检查公共 npm 的精确版本和元数据、最新索引 Schema、ID 来源、降版和依赖关系。
首次收录默认第三方身份，已收录模块保留维护者审核的官方身份。

PR 只修改索引仓的 `modules/<id>.json`。**不要手改或提交生成的 `index.json`**；合并后索引仓 Actions 自动构建聚合索引。
不使用命令行的作者可填写索引仓的 **申请收录或更新模块** Issue 表单，机器人读取公共 npm 元数据并生成审核 PR。

### 发布后自动同步版本

首次收录和展示信息调整通过元数据 PR 完成。模块录入后，索引仓 **Publish registry index** 每小时从公共 npm 的 `latest` 读取版本与 `peerDependencies.@sfmc-bds/sdk`，并同步 `modules/<id>.json` 和 `index.json`；也可在索引仓手动运行该工作流。

平台和模块仓的发布 CI 只负责 npm 与模块自身的 tag / Release，无需索引仓写权限，也不再上传版本 PR。预发布版本使用 `beta` 等独立 dist-tag；同步拒绝已发布版本的降版、预发布 `latest`、已弃用版本及无效 SDK 范围。请求失败时不会发布不完整的索引。

若旧索引登记的版本高于 npm latest，仅当 npm 明确返回该旧版本不存在（404）时，自动纠正为实际发布版本；网络错误或权限错误不能触发纠正。

PR 合并后，服主即可通过 CLI 检索并安装该模块：

```bash
# 1. 检索模块
sfmc mod search <id>

# 2. 安装并启用
sfmc mod install <id>
sfmc mod enable <id>
sfmc mod reload
```

## 3. 官方模块发布说明

官方团队维护的模块可通过主仓的 `module-publish` 工作流手动触发。若工作流的 GitHub Token 未配置模块仓 Git Tag 权限，请在发布参数中保持 `create_github_release=false`，待 npm 发布完成后，由具备写权限的维护者在对应模块仓打 Tag。

模块命名与本地联调请查阅 [业务模块开发指南](./module-author.mdx)。

## 附录：平台包发布（贡献者）

主仓核心包（`@sfmc-bds/*`）采用 Changesets 管理版本：

1. 运行 `pnpm run changeset` 生成变更说明。
2. 合并至 `main` 分支后，CI 会自动创建 Version PR。
3. 合并 Version PR 后自动触发 `ci-release-packages` 工作流完成 npm 发包。
   详见 [贡献指南](./contributing.md)。
