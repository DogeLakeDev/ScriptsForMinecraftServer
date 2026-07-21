# 模块管理指南

> SFMC v2 协议下的模块获取方式。模块是**外部仓库**的产物,通过 `tools/fetch-module.mjs` 拉取到主仓的 `modules/packages/<id>/`。模块 = 不可信第三方包,只通过 `@sfmc/sdk` 与平台对话。

## 1. 设计要点

```
Shiroha7z/sfmc-modules            ← 外部模块仓(独立 git repo)
  packages/<id>/
    sapi/manifest.json             ← v2 契约(schemaVersion: 2)
    sapi/src/index.ts
    package.json                   ← @sfmc/module-<id>
  index.json                       ← first-party registry

主仓 ScriptsForMinecraftServer/
  modules/packages/<id>/           ← fetch-module 拉下来后落地的源码
  modules/catalog.json             ← 本地 mirror(可由 fetch 同步)
  modules/module-lock.json         ← 运行期 enable/disable
  tools/fetch-module.mjs           ← 离线/在线获取 CLI
```

**关键约束**:
- 模块仓的 `sapi/manifest.json` 是**唯一真理源** —— SAPI、db-server、sfmc CLI 都直接读它
- 模块仓打 GitHub Release tag 后,`tools/fetch-module.mjs install` 解析 tarball 写入主仓
- 主仓的 `modules/catalog.json` 是**本地 mirror**,新模块安装后由 fetch 工具同步
- 主仓不直接发布模块,只发布 `@sfmc/sdk`

## 2. first-party registry

默认从 `Shiroha7z/sfmc-modules@main/index.json` 拉取注册表:

```jsonc
{
  "version": 1,
  "modules": {
    "feature-land":      { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" },
    "feature-land-gui":  { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" },
    "feature-economy":   { "repo": "Shiroha7z/sfmc-modules", "tag": "v1.5.0" },
    // ...
  }
}
```

`fetch-module` 解析 `<id>` → `github:<repo>@<tag>` → 拉 GitHub Release 的 tarball。

注册表缓存 `tools/.sfmc-registry-cache.json`(1h TTL)。离线时用上次缓存并 warn。

## 3. fetch-module CLI

```bash
# 列出 first-party registry 全部模块
node tools/fetch-module.mjs search

# 安装模块(默认从 first-party registry 拉)
node tools/fetch-module.mjs install feature-land

# 从指定 source
node tools/fetch-module.mjs install feature-foo --from github:owner/repo@v1.0.0
node tools/fetch-module.mjs install feature-foo --from local:/abs/path/foo.zip
node tools/fetch-module.mjs install feature-foo --from dir:/abs/path/foo/

# 校验(可选,GitHub 自动 .sha256 sidecar)
node tools/fetch-module.mjs install feature-land --from github:Shiroha7z/sfmc-modules@v1.5.0
# → 自动 fetch .zip + .zip.sha256,sha256 匹配后解压
```

## 4. sfmc module CLI(运行时,SEA 内可用)

```
sfmc module list                    # 扫 modules/packages/<id>/,列出每个模块
sfmc module info <id>               # 显示 manifest + 指纹
sfmc module verify [id]             # 重新计算指纹
sfmc module install <id> [--from <source>]
sfmc module uninstall <id>          # rm -rf modules/packages/<id>/
sfmc module enable <id>             # 写入 module-lock.json enabled=true
sfmc module disable <id>            # 写入 module-lock.json enabled=false
```

REPL 同样路径:
```
sfmc> module install feature-land --from github:Shiroha7z/sfmc-modules@latest
sfmc> module enable feature-land
```

## 5. 模块目录约定

```
modules/packages/<id>/
├── sapi/
│   ├── manifest.json          ← 必需,v2 协议契约
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           ← 入口,ModuleRegistry.register(...)
│       └── ...业务文件
├── configs-default/           ← (可选)默认 configKey 配置
├── resource_pack/             ← (可选)资源包内容
└── package.json               ← @sfmc/module-<id>,依赖 @sfmc/sdk
```

每个 `<id>` 必须符合 `modules/catalog.json` 里 `feature-* / core-*` 命名。

## 6. 端到端示例

### 6.1 全新主仓部署

```bash
# 1) 拉 land 模块
cd ScriptsForMinecraftServer
node tools/fetch-module.mjs install feature-land
# 拉 tarball + 解压到 modules/packages/feature-land/
# 同步 modules/catalog.json
# 写入 modules/module-lock.json { enabled: true }

# 2) 拉 land-gui
node tools/fetch-module.mjs install feature-land-gui

# 3) BP 构建 + deploy
sfmc behavior-pack build
sfmc behavior-pack deploy

# 4) 启动 db-server
node db-server/dist/index.js
# 启动日志:
#   [manifest v2] loaded 2 modules; provides 13 services
#   [manifest v2] enabled: feature-land, feature-land-gui

# 5) 启动 BDS,SAPI 装填模块
```

### 6.2 SEA 模式下

```bash
# SEA 不联网;module install 实际 spawn 子进程跑 tools/fetch-module.mjs
sfmc> module install feature-chat --from github:Shiroha7z/sfmc-modules@latest
# 安装完,modules/packages/feature-chat/ 出现
# 下次 SEA 重启时,db-server 扫描并装载
```

### 6.3 本地开发:从工作目录直接复制

```bash
# 你刚写完 feature-foo,想塞进主仓测一下
node tools/fetch-module.mjs install feature-foo --from dir:../sfmc-modules/packages/feature-foo/
sfmc behavior-pack build
```

## 7. 离线/内网场景

`fetch-module` 完全支持离线源:

```bash
# 1) 内网 / air-gapped 环境:下载 zip 后用 --from local
scp sfmc-module-feature-foo-1.0.0.zip server:/tmp/
node tools/fetch-module.mjs install feature-foo \
  --from local:/tmp/sfmc-module-feature-foo-1.0.0.zip \
  --sha256 a3f5b2c1d4e5f6...

# 2) 整个目录拷过去(--from dir)
node tools/fetch-module.mjs install feature-foo --from dir:/mnt/share/modules/feature-foo/
```

## 8. 与 db-server / SAPI 的关系

```
                    ┌──────────────────────────────────┐
                    │  Shiroha7z/sfmc-modules (外部)   │
                    │  - index.json (registry)         │
                    │  - packages/<id>/source code     │
                    └──────────────┬───────────────────┘
                                   │ git subtree / fetch tarball
                                   ▼
┌─────────────────────────────────────────────────────────┐
│  主仓 ScriptsForMinecraftServer                          │
│                                                          │
│   modules/packages/<id>/  ← esbuild 入口                │
│   modules/catalog.json    ← 静态 mirror                  │
│   modules/module-lock.json ← enable/disable state       │
│                                                          │
│   tools/fetch-module.mjs   ← 拉取 CLI                    │
│   tools/check-ootb.js      ← 启动前自检                  │
│   tools/lock.js            ← 指纹 / drift 检测            │
│                                                          │
│   db-server/               ← 跑在 127.0.0.1:3001         │
│     manifest-loader.ts     ← 读 v2 manifest,装载 enables │
│     schema-registry.ts     ← 收集 db.defineTable         │
│     tx-runner.ts           ← /api/sfmc/db/tx 派发         │
│     service-registry.ts    ← service.get 派发             │
│     permission-gate.ts     ← 启动 + 运行时权限校验         │
│                                                          │
│   modules/sdk/@sfmc-sdk/   ← npm @sfmc/sdk 的源码         │
└─────────────────────────────────────────────────────────┘
```

## 9. 常见问题

| 现象 | 原因 / 解决 |
|------|------------|
| `fetch-module search` 卡住 | 网络到 `raw.githubusercontent.com` 不通。检查代理 / 内网配置 |
| `HTTP 404` 拉 tarball | Release tag 不存在或 tarball 命名不符 `sfmc-module-<id>-<version>.zip` |
| sha256 校验失败 | 网络中间人篡改或文件被覆盖。从 first-party 重新拉 |
| `module install` 装完但 BDS 没装填 | ① 检查 `modules/module-lock.json` 是否有 `enabled: true`;② 重启 BDS(SAPI 不热重载) |
| `db-server` 启动报 `moduleId=... schemaVersion=1 (需要 2)` | 拉的模块是 v1 残留。检查是否需要升级到 v2 版本 |

---

下一步:看 [模块作者指南](./dev/module-author.zh.md) 写新模块,或 [SDK API 索引](./dev/sdk-reference.zh.md)。