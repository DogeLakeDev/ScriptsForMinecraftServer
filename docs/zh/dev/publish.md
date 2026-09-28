# 发布你的模块

把作者仓发到 npm，并登记到 [`sfmc-modules`](https://github.com/Tanya7z/sfmc-modules) 薄 index，供 `mod search` / `mod install` 发现。

业务模块 **不走** 主仓 changesets。平台 `@sfmc-bds/*` 发包见文末。  
`sfmc mod publish` 已移除；请用扩展 `SFMC: Publish to npm`，或直接 `pnpm publish`（及可选 `gh` 开 index PR）。

## 发布前

| 检查 | 说明 |
| ------ | ------ |
| `private` | 勿为 `true` |
| `name` | `@<user>/sfmc-module-<id>` 或官方 `@sfmc-bds/module-<id>` |
| `files` | 含 `sapi` |
| 类型检查 / lint | `pnpm run typecheck` 与 `pnpm run lint`；发布前按 [验证指南](./testing.md) 完成实际联调 |
| 发布权限 | npm registry 账号或 CI 发布凭据；官方 scope 另需组织权限 |

```bash
pnpm publish --access public
# 或按包上的 dist-tag：
pnpm publish --tag beta
```

向薄 index 开 PR：在 `sfmc-modules` 仓库的 `index.json` 增加条目（`id` / `npm` / 版本说明）。可用 GitHub CLI 自行开 PR。

:::tip 提示
正式版默认使用 npm `latest`；只有预发布包才在安装命令中显式指定对应的 dist-tag（例如 `@beta`）。

:::

## 发布后

1. 确认 index 出现该模块的 `npm` 字段  
2. 在 SFMC 工作目录：`sfmc mod install <id>`  
3. `mod enable` → `mod reload`

官方模块可从主仓手动运行 `module-publish` 工作流。主仓现有 `SFMC_GITHUB_TOKEN` 没有模块仓创建 Git tag 的权限，因此正式发布时保持 `create_github_release=false`；npm 发布成功后，由有模块仓写权限的维护者在对应模块仓为指定 `commit` 创建 `v<version>` 标签和 GitHub Release。补齐后再更新 `sfmc-modules` 索引。若以后为工作流配置了模块仓 Contents 写权限，可将 `create_github_release` 设为 `true`。

命名与联调见 [模块开发](./module-author.md)。

## 附录：平台包发布（贡献者）

主仓 `@sfmc-bds/*` 走 changesets：`pnpm run changeset` → Version PR → `ci-release-packages`。详见 [贡献指南](./contributing.md)。
