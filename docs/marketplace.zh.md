# 模块管理指南

> SEA 改造后的模块获取方式。SEA 把 SDK 伞包内嵌进 `.exe`,运行时**直接读 `modules/packages/<id>/`**。模块是约定目录,不存在自动从市场下载。

## 1. 设计要点

```
dist/sea/sfmc.exe          ← 含 dispatcher + @sfmc/sdk,1.9MB
modules/packages/<id>/     ← 业务模块,SAPI + db-server 运行时都从这里读
tools/fetch-module.mjs     ← 一次性 CLI,populate modules/packages/<id>/
sfmc module <verb>         ← 运行时只读 CLI(SEA 内可用),不能联网
```

**关键约束**:
- SEA 进程**不联网**。`sfmc module install` 在 SEA 模式下只是把活外包给 `tools/fetch-module.mjs`(子进程)。
- `modules/packages/<id>/sapi/manifest.json` 是唯一真理源 —— SAPI、db-server、sfmc CLI 都直接读它。
- 不再有 `modules/_manifests/module-manifests.json` 这种"emit 产物"。

## 2. sfmc module CLI(运行时,SEA 内可用)

```
sfmc module list                    # 扫 modules/packages/<id>/,列出每个模块
sfmc module info <id>               # 显示一个模块的 manifest + 指纹
sfmc module verify [id]             # 重新计算指纹;不传 id = 全部
sfmc module install <id> [--from <source>]
                                   # spawn tools/fetch-module.mjs
sfmc module uninstall <id>          # rm -rf modules/packages/<id>/
```

REPL 同路径:`sfmc> module install feature-land --from github:DogeLakeDev/ScriptsForMinecraftServer@latest`

所有命令都跑在 `./` 目录下,定位到 `modules/packages/<id>/`。SEA 模式下 `ROOT = path.dirname(process.execPath)`,所以 SEA exe 同级要有 `modules/packages/`。

## 3. tools/fetch-module.mjs(构建时 / 一次性)

populate `modules/packages/<id>/` 的离线 / 在线工具,三种 source:

```bash
# 从 GitHub Release 拉
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2

# 从本地 zip
node tools/fetch-module.mjs install feature-foo \
  --from local:/abs/path/foo.zip

# 直接复制目录
node tools/fetch-module.mjs install feature-foo \
  --from dir:/abs/path/foo/

# 列出 GitHub release 里有什么
node tools/fetch-module.mjs list --from github:DogeLakeDev/ScriptsForMinecraftServer@latest

# 校验(可选,如果有 .sha256 sidecar 或自己 --sha256)
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2 \
  --sha256 a3f5b2...
```

### GitHub Release 资产约定

GitHub Release `vX.Y.Z` 上的资产命名:
```
sfmc-module-<id>-<version>.zip
sfmc-module-<id>-<version>.zip.sha256   ← 可选,推荐
```

sidecar 文件格式(64-char lowercase hex + 双空格 + 文件名):
```
a3f5b2c1d4...  sfmc-module-feature-land-1.4.2.zip
```

zip 内部任意结构 —— fetch 工具解压到 `modules/packages/<id>/` 即可。db-server / SAPI / sfmc CLI 都会从这个目录读 manifest。

### SHA-256 校验

- GitHub 源:自动尝试 `.zip.sha256` sidecar,匹配失败则拒绝安装
- 本地 zip:必须传 `--sha256 <hex>` 或不校验
- 目录源:不校验(目录已存在 = 你信任它)

## 4. 模块目录约定

```
modules/packages/<id>/
├── sapi/
│   ├── manifest.json          ← 必需,模块契约
│   └── src/                   ← SAPI 入口
├── resource_pack/             ← 可选,资源包内容
└── package.json               ← 可选,workspace 元数据
```

每个 `<id>` 必须符合 `modules/catalog.json` 里 `feature-* / core-*` 的命名。db-server 启动会扫所有 `<id>/sapi/manifest.json`。

## 5. 端到端示例

### 5.1 第一次部署一个全新 SEA

```bash
# 1. 启动 SEA(空 modules/, db-server 报 modules=0)
./sfmc.exe
# 2. 在另一个 shell fetch 模块(SEA 之外,普通 Node 环境)
node tools/fetch-module.mjs install feature-land \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
node tools/fetch-module.mjs install feature-economy \
  --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
# 3. 重启 SEA → db-server 报 modules=2
./sfmc.exe
# [manifest] loaded schemaVersion=1 modules=2 routes=...
```

### 5.2 SEA 模式下通过 sfmc 安装

```bash
sfmc> module install feature-chat --from github:DogeLakeDev/ScriptsForMinecraftServer@v1.4.2
# sfmc spawn 子进程: node tools/fetch-module.mjs install ...
# sfmc 把子进程输出转发到 REPL
# 安装完后 modules/packages/feature-chat/ 出现 → 下次 SEA 重启时被扫描
```

### 5.3 本地开发:从工作目录直接复制

```bash
# 你刚写完 feature-foo,想塞进 SEA 测一下
node tools/fetch-module.mjs install feature-foo --from dir:../feature-foo-work/
./sfmc.exe restart db
# db-server 扫描到 feature-foo
```

### 5.4 验证安装完整性

```bash
sfmc module verify
# Verifying installed modules
#   feature-land                    a3f5b2…c1d4e7
#   feature-economy                 b7d218…f09a3c
#   feature-foo                     d4e5f6…789abc

sfmc module info feature-land
# feature-land
#   path        : /.../modules/packages/feature-land
#   files       : 8
#   size        : 12.3 KB
#   fingerprint : a3f5b2c1d4...
#   schemaVer   : 1
#   routes      : 4
#     GET      /api/sfmc/lands          lands:list
#     POST     /api/sfmc/lands          lands:create
#     ...
```

## 6. 与 db-server / SAPI 的关系

```
              ┌────────────────────────┐
              │   sfmc.exe (SEA)       │
              │   - dispatcher         │
              │   - @sfmc/sdk 内嵌     │
              │   - sfmc CLI           │
              └──────────┬─────────────┘
                         │ spawn 子服务
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
  db-server          qq-bridge         bds-tools
       │
       │ 启动时扫 modules/packages/<id>/sapi/manifest.json
       ▼
  modules/packages/<id>/sapi/manifest.json   ← 唯一真理源
       ▲
       │ SAPI 也在 SAPI bundle 内读同一份 manifest
```

`sfmc module install` **只动 `modules/packages/<id>/` 的文件**,不会自动:
- 改 `modules/module-lock.json`(启用/禁用状态)
- 重启 db-server / BDS
- 跑 `npm run build:full`

**完整闭环**(手动):
```
node tools/fetch-module.mjs install feature-land --from github:...
vim modules/module-lock.json           # enabled=true
sfmc> restart db
# 然后 BDS 控制台 reload BP
```

## 7. 不在本轮范围

- 自动签名 / 公钥验证(只用 SHA-256 指纹)
- 远端 zip 自动签名校验(sidecar 也只是明文指纹,不是密钥签名)
- 模块签名后再分发(`sfmc module publish`)
- `install --enable-and-deploy` 一条龙串联
- 多源并发 / 依赖解析

这些是 Stage L+ roadmap。