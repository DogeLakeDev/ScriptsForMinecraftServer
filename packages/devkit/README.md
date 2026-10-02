# @sfmc-bds/devkit

模块作者工具核心：Watch、重建部署、启停、索引提交。供 CLI、VS Code/Cursor 扩展与 CI 复用。

重建部署需要另行安装 `@sfmc-bds/cli`（扩展自带），或通过 `SFMC_CLI` / `cliPath` 指定入口；仅提交索引无需安装 CLI 或初始化服务器。

建仓请用：

```bash
pnpm dlx @sfmc-bds/create-module@latest
```

```ts
import { startModuleWatch, rebuildAndDeploy, setModuleEnabled } from "@sfmc-bds/devkit";
```

## 索引提交

```bash
# 在作者仓根目录；预览也会核对公共 npm 精确版本和最新索引分片。
sfmc-module-submit --dry-run
sfmc-module-submit
# 或使用 CLI：sfmc mod submit [模块目录] [--dry-run]
```

提交使用 `GH_TOKEN` / `GITHUB_TOKEN`，或 `gh auth login` 的登录凭据。有目标索引仓写权限时在该仓建 PR 分支，否则通过 fork 提供来源分支；`--no-fork` 可显式选择在目标索引仓建分支。
提交路径不按账号名、仓库 owner 或模块 `official` 字段分类；只检查写权限与 PR 所需的仓库关联。
仓库迁移与 fork 关系按 GitHub 仓库 ID 判断，兼容旧地址重定向。
需要目标分支仓 Contents 写权限以及索引仓 Pull requests 写权限。`--wait-for-publish` 在 npm 返回 404 时最多等待 60 秒。
`--registry owner/repo` 可指定兼容的索引仓；`--entry-file <JSON>` 供受控 CI 入口提交条目，仍执行相同校验。

```ts
import { submitModuleToRegistry } from "@sfmc-bds/devkit";
const preview = await submitModuleToRegistry({ moduleRoot: "/path/to/module", dryRun: true });
const result = await submitModuleToRegistry({ moduleRoot: "/path/to/module" });
console.log(result.status, result.prUrl);
```

`sfmc.registry.json` 可补充 `name`、`description`、`category`、`tags`、`authors`，编辑器规范见 `schemas/registry-author.schema.json`。
更新已有模块时，未配置覆盖的名称、介绍以及未指定的分类、标签、作者署名沿用索引条目。
ID、requires 来自 `sapi/manifest.json`；包名、版本、许可证、repository、SDK peerDependency 来自 `package.json`。
仅 `modules/<id>.json` 会进入 PR。相同内容跳过；已有待审 PR 按模块复用；拒绝包来源冲突、降版、未知依赖和循环依赖。
首次收录为 `official: false`，已有身份沿用索引仓；官方认证由维护者审核。
