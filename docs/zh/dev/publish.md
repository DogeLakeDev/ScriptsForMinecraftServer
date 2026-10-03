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
提交需要 `gh auth login` 或 `GH_TOKEN`。有索引仓写权限时自动在索引仓建 PR 分支；其他作者自动 fork、创建分支并开 PR。相同内容不重复提交，新版本复用已有待审 PR。
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

### 发布后自动提交

官方主仓 `module-publish` 在实际 npm 发布成功后调用 `module-index-submit.yml`，dry-run 不提交。
请在主仓配置 `REGISTRY_SUBMIT_TOKEN`，授予索引仓 Contents / Pull requests 写权限；建议使用 GitHub App 或专用维护者凭据。
普通 `GITHUB_TOKEN` 的权限仅覆盖当前仓库，且它创建的 PR 通常不会触发后续 PR 工作流，因此这里使用独立凭据。

已获维护者授权的仓库可在发布 job 成功后复用入口：

```yaml
submit-index:
  needs: publish
  uses: DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/module-index-submit.yml@main
  with:
    module_repository: ${{ github.repository }}
    module_ref: ${{ github.sha }}
  secrets:
    REGISTRY_SUBMIT_TOKEN: ${{ secrets.REGISTRY_SUBMIT_TOKEN }}
```

一般第三方作者使用一键命令或表单，无需官方仓写权限。
提交工具只读取模块 JSON，不运行模块仓脚本。索引提交失败不会撤回已发布的 npm 版本；可手动运行 **Submit module registry PR** 重试，无需重新发布 npm。

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
