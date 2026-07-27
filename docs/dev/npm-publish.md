# npm 发布指南

> SFMC 平台拆分为多个 `@sfmc-bds/*` scoped 包，各包 **独立 semver**，由 [changesets](https://github.com/changesets/changesets) 管理版本与 changelog。
>
> **当前阶段：beta-only。** 所有新发布走 npm dist-tag `beta`（版本形如 `0.2.0-beta.0`）。未达 release 门槛前禁止 `changeset pre exit` / 发到 `latest`。
>
> 最新beta版本安装：`npm i -g @sfmc-bds/sfmc@beta`

## 包清单

| npm 包 | 目录 | 说明 |
| -------- | ------ | ------ |
| `@sfmc-bds/sdk` | `modules/sdk/@sfmc-sdk/` | 模块作者 SDK（SAPI + Node） |
| `@sfmc-bds/eslint-plugin` | `modules/sdk/@sfmc-eslint-plugin/` | SFMC 约定 ESLint 规则 |
| `@sfmc-bds/cli` | `sfmc/` | 管理 CLI（`sfmc` 命令） |
| `@sfmc-bds/db-server` | `db-server/` | SQLite HTTP REST 后端 |
| `@sfmc-bds/qq-bridge` | `qq-bridge/` | QQ ↔ MC 桥接 |
| `@sfmc-bds/bds-tools` | `bds-tools/` | BDS 更新与行为包装配 |
| `@sfmc-bds/tools` | `tools/` | 开发/安装工具脚本 |
| `@sfmc-bds/sfmc` | `sfmc-meta/` | **聚合包**：一条命令装齐平台 |

可发包清单权威来源：[`tools/lib/npm-publish-packages.mjs`](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/tools/lib/npm-publish-packages.mjs)。

`@sfmc-bds/remote-controller` 为内部实验包，**不发布**（已在 `.changeset/config.json#ignore`）。

根 `package.json`（`sfmc-monorepo`）保持 `private: true`。

## Semver 对照

| 变更类型 | bump | changeset `type` | 示例（stable） | 当前 beta |
|----------|------|------------------|----------------|-----------|
| Bug 修复（兼容） | patch | `patch` | `1.0.0` → `1.0.1` | 同线 `*-beta.N` 递增 |
| 新功能（兼容） | minor | `minor` | `1.0.0` → `1.1.0` | `0.1.0` → `0.2.0-beta.0` |
| 破坏性变更 | major（≥1.0）/ minor（0.x） | `major` / `minor` | `1.0.0` → `2.0.0` | 0.x 抬 minor 再挂 `-beta.N` |

## 日常开发流程

1. 改可发包代码后：`npm run changeset`，选包 + type，写中文摘要。
2. PR 合入 `main` 后，[changeset-release.yml](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.github/workflows/changeset-release.yml) 会开/更新 **Version Packages** PR。
3. 维护者审查并合并 Version PR → CI 跑 `ci-release-packages`（publish + tag + GitHub Release；pre mode → npm **`beta`**）。

### Version PR 权限（必读）

`changesets/action` 用 `GITHUB_TOKEN` 开 PR 时，若仓库/组织关闭了 **Allow GitHub Actions to create and approve pull requests**，会报：

`HttpError: GitHub Actions is not permitted to create or approve pull requests`

（版本 bump 分支 `changeset-release/main` 可能已推送，但 PR 未创建。workflow 已声明 `pull-requests: write` 仍不够。）

任选其一：

1. **推荐（零 Secret）**：Repo Settings → Actions → General → Workflow permissions → 勾选 *Allow GitHub Actions to create and approve pull requests*。
2. **PAT**：写入 Secret **`SFMC_GITHUB_TOKEN`**（能开本仓 PR）；workflow 优先用该 token，其次兼容旧名 `CHANGESETS_GITHUB_TOKEN`，再回退 `GITHUB_TOKEN`。

### 本地一键发版（`tools/run-release.mjs`）

当前 pre mode 请用：

```bash
npm run prerelease-packages
```

流程：assert → ensure changeset → `changeset version` → commit → git tag → push → npm publish → GitHub Pre-release。

| 脚本 | 何时用 |
|------|--------|
| `prerelease-packages` | **现在**（pre/beta；`run-release.mjs --pre`） |
| `release-packages` | 仅 `changeset pre exit` 之后（latest；`--stable`） |
| `ci-release-packages` | CI 专用（`--ci`，无交互）。tag 默认按 `HEAD~1` 版本 diff；仅显式 `--from-existing` / `SFMC_TAG_FROM_EXISTING=1`（或浅克隆无法解析父提交）才只收录已有 tag。空的 `.sfmc-release-tags.json` 表示本轮无目标，下游不得回退扫全仓。push / gh-release 缺失态分别回退 `listUnpushedExistingVersionTags` / `listPackagesWithExistingVersionTags`。 |
| `build:publishable` | 按 `NPM_PUBLISH_PACKAGES` 拓扑构建可发包；`node tools/build-publishable.mjs [--workspace <pkg>]`。changeset-release 全量、npm-publish 应急补发（含依赖闭包）共用，勿在 YAML 再抄 workspace/依赖列表。 |

需要：本机已登录 `gh`、npm（或 `NPM_TOKEN`），且对 `origin` 有推送权限。

## Beta-only（硬约束）

- 仓库含 [`.changeset/pre.json`](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.changeset/pre.json)：`mode: pre`, `tag: beta`。
- 安装文档与脚手架一律写 `@beta`。
- 已存在的 `latest` 上的 `0.1.0` **保留不动**；稳定通道未开放。
- **退出 beta → latest 门槛（全部满足才 `changeset pre exit`）**：
  - `npm run check-ootb` + 关键路径 smoke 稳定绿
  - 聚合包 init / 模块安装 / BP build·deploy 有书面验收
  - SDK 模块作者契约相对冻结（或已发迁移说明）
  - 无已知 BLOCKER；维护者显式批准「首个 latest」

退出流程（达标后）：

```bash
npx changeset pre exit
npx changeset version    # 去掉 -beta 后缀，得到正式版如 0.2.0
npx changeset publish    # → latest
```

## 应急单包补发

[npm-publish.yml](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.github/workflows/npm-publish.yml) 仅 `workflow_dispatch`：

- 默认 `dist_tag=beta`
- 若仍处于 pre mode，选择 `latest` 会被 workflow 拒绝
- build 步骤调用 `build-publishable.mjs --workspace <pkg>`：先按 `listPublishableBuildDeps` 构建可发包依赖（如 `@sfmc-bds/cli` → sdk + bds-tools），再构建目标；勿再硬编码只 build SDK

## 本地验证（发布前）

```bash
npm install
npm run pack:verify
```

## 首次发布 org / Token

1. npm 账号登录并确认 org [sfmc-bds](https://www.npmjs.com/org/sfmc-bds)
2. Granular Access Token（Automation）写入 GitHub Secret `NPM_TOKEN`
3. （可选）若无法开启 Actions「create and approve pull requests」：写入 `SFMC_GITHUB_TOKEN`（见上文 Version PR 权限；旧名 `CHANGESETS_GITHUB_TOKEN` 仍可用）

## 模块包

业务模块在 `Tanya7z/sfmc-modules`，不走本仓 changesets / CI。

## 发版节奏（release 前）

| 阶段 | 建议 |
|------|------|
| 现在～首个 latest | 只发 beta；积满 changeset 合 Version PR 即可（可每周 1～3 次） |
| 首个 latest | 仅当退出门槛全过 |
| ≥1.0 之后 | 双周 latest；大功能可再进 beta |
