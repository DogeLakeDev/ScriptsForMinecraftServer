# Changesets

本仓用 [changesets](https://github.com/changesets/changesets) 管理 `@sfmc-bds/*` 的独立 semver。

## 当前阶段：beta-only（pre mode）

见 `pre.json`：`mode: pre`, `tag: beta`。版本形如 `0.2.0-beta.0`，npm dist-tag 为 **`beta`**。

未达 release 门槛前 **禁止** `changeset pre exit` / 发到 `latest`。

## 日常开发

```bash
# 改完可发包代码后
npm run changeset
# 选受影响的包 + patch|minor|major，写中文摘要
```

然后 **push `main`** 即可：CI 会开/更新 Version Packages PR；合并该 PR 后自动 `ci-release-packages`（publish → tag → push → GitHub Release）。

本地一般 **不需要** 手动跑发版命令。

## CI 发版入口

根 `package.json`：

| 脚本 | 谁调 |
|------|------|
| `version-packages` | changesets/action（Version PR） |
| `ci-release-packages` | 合并 Version PR 后的 publish 步骤 |
| `build:publishable` | CI build 可发包拓扑 |

应急单包：`.github/workflows/npm-publish.yml`（`workflow_dispatch`）。

详情见 [docs/zh/dev/publish.md](../docs/zh/dev/publish.md)。
