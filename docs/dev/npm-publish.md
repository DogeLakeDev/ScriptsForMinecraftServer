# npm 发布指南

> SFMC 平台拆分为多个 `@sfmc-bds/*` scoped 包，各包独立 semver。服主推荐安装聚合包 `@sfmc-bds/sfmc`；其余包面向模块作者与 Node 侧集成。

## 包清单

| npm 包 | 目录 | 说明 |
|--------|------|------|
| `@sfmc-bds/sdk` | `modules/sdk/@sfmc-sdk/` | 模块作者 SDK（SAPI + Node） |
| `@sfmc-bds/eslint-plugin` | `modules/sdk/@sfmc-eslint-plugin/` | SFMC 约定 ESLint 规则 |
| `@sfmc-bds/cli` | `sfmc/` | 管理 CLI（`sfmc` 命令） |
| `@sfmc-bds/db-server` | `db-server/` | SQLite HTTP REST 后端 |
| `@sfmc-bds/qq-bridge` | `qq-bridge/` | QQ ↔ MC 桥接 |
| `@sfmc-bds/bds-tools` | `bds-tools/` | BDS 更新与行为包装配 |
| `@sfmc-bds/tools` | `tools/` | 开发/安装工具脚本 |
| `@sfmc-bds/sfmc` | `sfmc-meta/` | **聚合包**：一条命令装齐平台，装完即可 `sfmc` 初始化 |

服主若走 npm，推荐直接：

```bash
npm install -g @sfmc-bds/sfmc
mkdir my-server && cd my-server && sfmc
```

`@sfmc-bds/remote-controller` 为内部实验包，**不发布**。

根 `package.json`（`sfmc-monorepo`）保持 `private: true`，仅作 workspace 编排。

## 首次发布前：确认 org `sfmc-bds`

1. 使用 npm 账号 [shiroha7z](https://www.npmjs.com/~shiroha7z) 登录
2. 确认已创建 org：[sfmc-bds](https://www.npmjs.com/org/sfmc-bds)（scoped 包前缀为 `@sfmc-bds/*`）
3. 创建 **Granular Access Token**（Automation 类型）：
   - Packages: Read and write，scope 限定 `@sfmc-bds/*`
4. 在 GitHub 仓库 `DogeLakeDev/ScriptsForMinecraftServer` → Settings → Secrets → `NPM_TOKEN`

## 本地验证（发布前必跑）

```bash
npm install
npm run pack:verify
```

会在仓库根目录生成 `*.tgz`，可用 `tar -tf sfmc-bds-sdk-0.1.0.tgz` 确认仅含 `dist/` 与元数据。

## 手动首发

建议顺序：SDK → 平台组件 → 聚合包（聚合包依赖前者）。

```bash
npm run build --workspace @sfmc-bds/sdk
npm publish --workspace @sfmc-bds/sdk --access public

npm run build --workspace @sfmc-bds/db-server
npm publish --workspace @sfmc-bds/db-server --access public

# 同理: @sfmc-bds/qq-bridge, @sfmc-bds/bds-tools, @sfmc-bds/tools, @sfmc-bds/cli
# 最后:
npm publish --workspace @sfmc-bds/sfmc --access public
```

## CI 自动发布

推送符合格式的 git tag 即可触发 [`.github/workflows/npm-publish.yml`](../../.github/workflows/npm-publish.yml)。
可发包清单的唯一权威来源是 [`tools/lib/npm-publish-packages.mjs`](../../tools/lib/npm-publish-packages.mjs)（workflow 解析/校验都读它，勿在 yaml 再抄一份）。

```bash
# 1. 先在对应 package.json 里 bump version
# 2. commit
git tag @sfmc-bds/sdk@v0.1.0
git push origin @sfmc-bds/sdk@v0.1.0
```

Tag 中的版本号必须与 `package.json` 的 `version` 字段一致（不含 `v` 前缀的数值部分对应，tag 带 `v`）。

## 模块包（可选双通道）

业务模块在 `Tanya7z/sfmc-modules` 以 `@sfmc-bds/module-<id>` 命名，可本地 `npm publish`。
当前 `npm-publish.yml` **只覆盖** `tools/lib/npm-publish-packages.mjs` 中的平台包；模块 tag 不会走该 CI（避免与平台包清单漂移）。

```bash
# 模块包请在 sfmc-modules 仓或本地发布,勿假设 @sfmc-bds/module-*@v* 会触发本仓 workflow
npm publish --workspace @sfmc-bds/module-land --access public
```

模块 `package.json` 应声明 `"@sfmc-bds/sdk": "^0.1.0"`。

## 版本策略

- 各包 **独立 semver**，首发均为 `0.1.0`
- 平台组件对 SDK 使用 `"@sfmc-bds/sdk": "^0.1.0"`；monorepo 内 workspace 链接自动覆盖
- 发布走 scoped tag（如 `@sfmc-bds/sdk@v0.1.0`），由 `npm-publish.yml` 触发
