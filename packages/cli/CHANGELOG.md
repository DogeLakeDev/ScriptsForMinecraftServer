# @sfmc-bds/cli

## 0.2.0-beta.9

### Minor Changes

- 3c07ced: 移除远程控制功能：删除 `sfmc remote` / WebSocket agent、`configs/remote.json` 与对应 schema；不再提供 `@sfmc-bds/remote-controller` 包。

### Patch Changes

- 89ffceb: Linux BDS 宿主：按平台解析可执行文件与下载 URL，启动时设置 LD_LIBRARY_PATH；argv start 在 POSIX 上 daemonize；pgrep 用 -x 避免误匹配
- 89ffceb: 修复 LLBot 启动：兼容向导把 llbot_path 写成目录导致 spawn ENOENT
- f3ba416: 游戏聊天互通：MC→QQ 仅转发 `bridge_channel_id` 匹配且非 `qq_` 回环的 messages；QQ 指令「频道」只读提示；扫描 `modules/packages` 时跟随 symlink（修复 `--link` 在 Linux 下被当成非目录）
- ec728dd: CLI 对外部 db/qq 真正 stop/restart（按入口脚本杀进程，避免双实例）；QQ 主/管理菜单中文编号样式（official+llbot 共用）；频道/自检增强
- 89ffceb: 群服互通支持 QQ 开放平台官方 Bot（双后端可切回 LLBot）
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [f3ba416]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [89ffceb]
- Updated dependencies [3c07ced]
  - @sfmc-bds/bds-tools@0.2.0-beta.9
  - @sfmc-bds/sdk@0.2.0-beta.9

## 0.2.0-beta.8

### Minor Changes

- 8552772: feat(sfmc): 作者向 mod test/watch/publish 迁出 CLI

  运维保留 build/reload/install；作者改用 VS Code 扩展与 @sfmc-bds/devkit。
  调用已删子命令时给出迁移提示。

- 8552772: chore: 删除已无仓内调用的公开兼容导出

  破坏性（外部若仍 import 需改用替代）：

  - `@sfmc-bds/cli`：移除 `serviceStatus`（用 `queryServicesRuntime`）、`HELP`（用 `getHelp`）、
    `resolveDefaultsDir` / `seedMissingConfigsFromDefaults`、`CommandChannel: "external"` /
    `PaletteEntry` / `listPaletteEntries` 等遗留表面。
  - `@sfmc-bds/bds-tools`：移除已不抛出的 `Utf8BomError` 类及 re-export（读 JSON 仍自动剥 BOM）。

- 8552772: feat(sfmc): mod enable/disable 本地写 lock，db 在线时 best-effort 热同步

  启停不再强依赖 db-server：先写 `module-lock.json`，再尝试 POST；通知失败仍成功并警告。

### Patch Changes

- Updated dependencies [8552772]
- Updated dependencies [8552772]
- Updated dependencies [e175ed9]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
- Updated dependencies [8568388]
  - @sfmc-bds/sdk@0.2.0-beta.8
  - @sfmc-bds/bds-tools@0.2.0-beta.8

## 0.2.0-beta.7

### Patch Changes

- b81327a: sdk:移除对旧版type的支持 tools,cli:杂项
- Updated dependencies [b81327a]
  - @sfmc-bds/sdk@0.2.0-beta.7

## 0.2.0-beta.6

### Minor Changes

- 466d214: feat(tools): `sfmc mod install` 默认走 npm；`--from local` 接受 dir/.tgz/.zip

  - `tools/lib/npm-resolver.mjs`：单一权威的 npm 包名解析（短 id / feature-* / core-* / @scope/name）。
  - `tools/fetch-module.mjs`：
    - 新增 `npm:` 前缀（`npm install --prefix packages/<id> --omit=dev --no-save` 隔离安装）。
    - 新增 `tgz:` / `zip:` 显式前缀；`local:` 现在接受 dir/`.tgz`/`.zip`，无路径默认 cwd。
    - `fromLocal` 重构为单一入口（resolveLocalPath），避免 dir/tgz/zip 解析分散。
    - zip 安装强制校验内含 `package.json` + `sapi/manifest.json`，缺关键文件硬错误并清理污染目录。
    - tgz 安装委托 `npm install --prefix tmp <tarball>`（不重新发明 tar，零新依赖）。
    - 缺省 source 解析：先看 first-party registry（兼容 `Tanya7z/sfmc-modules`），否则按 `@sfmc-bds/module-<folder>` 走 npm；常见 npm 错误翻译为中文可读 + 下一步动作（404 / EACCES / ERESOLVE / ETIMEDOUT）。
  - `tools/install-resolver.test.mjs` + `tools/local-resolver.test.mjs`：表驱动共 16 用例通过。
  - 文档：`docs/guide/modules.md` + `docs/dev/module-author.md` 增「安装源」表格，钉死 default 解析顺序。

- 53d7119: feat(sfmc): 新增 `sfmc mod publish` 保姆式 CLI

  - 流水线：npm whoami 检测 → scope 推断（默认 `<npm-username>`）→ dry-run 预检 → version bump → `npm publish` 透传 → 薄 index PR（占位）。
  - 错误翻译（npm 原文 → 中文 + 下一步动作）：`ENEEDAUTH` / `EOTP` / 邮箱未确认 / 无权限 publish / 402 Payment / 包名太接近 / `ERESOLVE` / `ETIMEDOUT` / 默认透传。
  - dry-run 预检三件套：manifest v2 schema、package.json#files 含 `sapi/`、`npm pack --dry-run` 解析 tarball 文件清单。
  - version bump：`patch` / `minor` / `major` / `custom <x.y.z[-prerelease]>`；写入 `package.json#version`，**不改** manifest；publish 失败时回滚 bump。
  - scope 模型：作者发自己 scope（`@<username>/sfmc-module-<id>`）；**不**触碰 `@sfmc-bds/*`（与 `mod install` 隔离）。
  - 薄 index PR：当前为占位（`gh api` 真实调用需 `gh auth login` + 远端 `sfmc-modules` 仓；保留 `--skip-index-pr` 选项）。
  - Windows 兼容：`spawn npm.cmd` 通过 `cmd /c npm`（避开 DEP0190 安全警告 + `shell:true` 隐患）。同步修复 `cmdModuleTest` 同样问题。
  - 测试：`module-publish.test.mjs` 8 cases（parsePublishFlags / bumpSemver / 错误翻译表 / runPrecheck / defaultScopeFor）；sfmc workspace 85/85 通过。
  - i18n：`publish.*` 中英文案 + `help.module.publish` 子命令描述。

  > CLI 是 `npm publish` 的编排器 + 检查器 + 错误翻译；**不**替身 npm 行为。所有鉴权（`npm login --auth-type=web` / 2FA / 邮箱确认）走 npm 本身。

- 2a5b502: feat(sfmc): `mod publish` 接 gh CLI 真实开薄 index PR

  - `openIndexPr` 从占位升级成可执行：检测 `gh` 鉴权 → `gh repo fork` → clone fork → `git checkout -b publish/<id>-<ver>` → patch `index.json`（upsert 幂等）→ `git commit` → `git push` → `gh pr create`。
  - 新 CLI flags：
    - `--gh-repo OWNER/REPO`（默认 `Tanya7z/sfmc-modules`）
    - `--gh-push` 显式 opt-in 真执行（否则只打印意图，避免误污染远端）
    - `--gh-fork-remote <name>`（默认 `sfmc-modules-fork`）
  - 安全：默认行为 = 打印 intent + gh 命令清单（dry-run 友好）；真执行需 `--gh-push`；缺鉴权时降级为 dry-run + 提示 `gh auth login`。
  - 新函数 `indexEntryFor(pkgName, version, sdkRange)` / `splitOwnerRepo(s)` / `patchIndexFile(path, entry)` —— 单一职责，可单测。
  - `patchIndexFile` 校验 `id` 已存在则报错（避免静默覆盖历史版本）。
  - 测试：`module-publish.test.mjs` 加 8 cases（splitOwnerRepo / indexEntryFor / patchIndexFile 缺文件 / 追加排序 / 重复 id / openIndexPr dry-run / skip-index-pr / 非法 repo）；sfmc workspace **93/93** 通过。
  - npm publish 成功但 PR 失败 → **不回滚 publish**（包已发）；给明确「手动补 index.json」提示。

- c72fdc8: feat(tools): 脚手架转向 cwd 单包根（与 Tanya7z/sfmc-module-template 同构）

  - `tools/new-module.mjs`：
    - 默认（缺省 `--root`）：写到 **cwd** 作为单包根（包根 = 包仓库根），生成自包含 `package.json` + 自包含 `sapi/tsconfig.json` + `$schema` 指向 `node_modules/@sfmc-bds/sdk`。
    - `--root <path>` / `SFMC_MODULES_ROOT` 显式 legacy 模式：仍写到 `<root>/packages/<id>`（兼容旧 sfmc-modules 工作区）。
    - 拒绝 `--root` 指向主仓 `modules/packages`（那是 install 落点，不是开发工作区）。
    - 终端打印「模式: cwd 单包根 / legacy 工作区」+ 各自的下一步命令。
  - `tools/scaffold-redirect.test.mjs`：5 cases 表驱动（cwd 单包 / legacy / 拒主仓 / 缺 packages / env fallback）。
  - i18n：`modwiz.genPackage` / `modwiz.skeletonWritten` 等改为 cwd 友好文案。
  - 文档：上一轮 `module-author.md` 已写明 `sfmc module create` 在模块仓根执行 + `--from local --link` 装入主仓；本 PR 落地脚手架默认行为。

- 2580488: feat(sfmc): 新增 `mod watch` 与 `mod test` 子命令

  - `sfmc mod watch [--from local[:path]] [--no-reload]`：监听 `sapi/src/**` 变更，~200ms 防抖后复用 `mod reload` 同一路径（build → deploy → 直写 BDS stdin 发 `reload`）。改 `sapi/manifest.json` / `sapi/tsconfig.json` 仅提示「SAPI 启动期缓存，请重启 BDS 进程」。
  - `sfmc mod test [--from local[:path]] [-- <args>]`：解析 `--from local[:path]`，spawn `npm test` 透传 stdio，让模块仓的 `scripts.test` 自己决定怎么跑。
  - 进程探测复用 `queryServicesRuntime` + `probeBdsStatus`（与 `mod reload` 同源），不另写一遍 reload 路径。
  - i18n：新增 `watch.*` / `help.module.watch|test` 中英文案。
  - 模板仓 `Tanya7z/sfmc-module-template` 已在主仓外部 `D:\#WorkPlace\#MCBEProjects\sfmc-module-template\` 初始化并 commit；本仓库仅交付 CLI 与文档改动。
  - 测试：sfmc workspace `npm test` 77/77 通过（含新增 6 个 watch resolver 表驱动用例）。

- af175bc: feat(tools): 新增 `tools/verify-module-publish.mjs` pre-publish 守门

  - 7 类硬检查（exit 1）：manifest v2 schema / 必填字段 / `package.name` 与 `manifest.id` 折叠一致 / `package.files` 含 `sapi/` / `npm pack` 真实产物 tar 解析（验 `package.json` + `sapi/manifest.json` + `sapi/src/**`）/ 无 `@sfmc/sdk` 旧别名 / 显式声明 `@sfmc-bds/sdk` 依赖。
  - 跨模块源码 import 警告（exit 0；不阻塞 publish）：相对路径深挖 ≥ 2 级、未授权模块引用。
  - npm pack tar 解析：极简 tar 头解析器（512-byte 块 + null-padded name/size + typeflag）；用 `zlib.gunzipSync` 解 gzip（无新依赖）。
  - Windows spawn：直接调 `node npm-cli.js`（不绕 cmd.exe）；合并 stdout + stderr（npm 11+ 把 notice 打到 stderr，tgz 名在 stdout）。
  - 复用 `@sfmc-bds/bds-tools/zipx` 已有的同思路（防 zip-slip），不重复发明。
  - 测试 `tools/verify-module-publish.test.mjs` 5 cases：模板仓（good fixture）+ 4 个坏 fixture（缺 manifest / 错 schemaVersion / name 不匹配 / 旧别名）。
  - sfmc workspace 仍 93/93；全仓 typecheck 干净。
  - 单独可跑；CI 可 `node tools/verify-module-publish.mjs` 拦截 publish。

- 5567073: 重构：统一服务运行时查询并增强服务状态管理

### Patch Changes

- b55557b: 纯 index 契约：`--link` 支持 `local:`；index map 支持 `npm`；拆除旁路 sfmc-modules monorepo DX；`mod publish` 写 map 并拒绝 private/非官方 `@sfmc-bds`。
- e7e7e61: // @ts-check：添加到 23 个 tools/_.mjs 脚本 + 11 个 tools/lib/_.mjs 库 + 5 个 tools/_.test.mjs + 11 个 sfmc/_.test.mjs + 5 个 changeset 系列
- Updated dependencies [c72fdc8]
- Updated dependencies [0992ab9]
  - @sfmc-bds/sdk@0.2.0-beta.6

## 0.2.0-beta.5

### Minor Changes

- 06e0f19: \# feat/reactor：为CLI命令添加命令界面和帮助文本

  \- 实现了command-surface.ts文件，用于定义CLI命令的规范、通道及可见性规则。

  \- 创建了help-text.ts文件，根据命令在argv和REPL模式下的可见性提供帮助文档。

  \- 引入了pack-update/index.ts文件，封装了包含必要依赖项和日志记录的包更新功能。

  \- 添加了send-target.ts文件，用于在REPL中管理发送目标，包括服务状态和提示符样式。

- c890a95: feat(sfmc-cli): 命令通道分层（external / repl / both）

  - 单一权威 `command-surface`：部署类（install/create/debug 等）仅外部；send / logs -f 仅 REPL
  - help 按通道过滤；dev 类命令蓝色展示（无独立 devmode 开关）
  - 去掉 `devmode` / `runtime.json#developer_mode` 门禁

- c890a95: feat(sfmc/bds-tools): CLI UX 分层、pack-update 迁出、OS 进程探活

  - REPL：`/` + Ctrl+P 命令面板、左右光标、quit 干净退出
  - argv：`sfmc i|install`、`sfmc -p …`；help 按通道标准化
  - pack-update 迁入 `@sfmc-bds/bds-tools/pack-update`（CLI 薄封装）
  - process-probe：外部 BDS 可识别；status 区分 managed/external

- 1f7b2c7: feat(sfmc): 新增 `debug` 顶层命令管理 BDS 调试配置

  - 直接读写 `<BDS>/config/default/variables.json` 与 `secrets.json`
  - 子命令：status / enable / disable / sentry on --dsn <dsn> / sentry off
  - 不修改 SDK 现有 `applyDebugFromVariables()` / `initSentryIfConfigured()` 语义
  - CLI = 配置入口；行为包运行时由 SDK 读取
  - 变更后需 `sfmc mod reload` 或重启 BDS 生效

- 2c91645: feat(sfmc): module build / reload 改走 spawn bds-tools/cli-pack-manager.ts

  - 新增 sfmc/src/module-pack-build.ts：spawn assemble-bp / assemble-rp / deploy / enable-pack / disable-pack / ensure-permission 各 verb
  - dispatchModuleCommand 的 build / reload case 改为 import 此文件
  - pack-lifecycle.ts 保留 ensurePacksReady 启动钩子与 wizard 内部消费
  - 模块 build 唯一权威派发入口收敛（与 install/uninstall/create 同架构：CLI = thin wrapper）

### Patch Changes

- c890a95: feat(bds-tools): 将 pack-update 域逻辑迁入 `@sfmc-bds/bds-tools/pack-update`

  - 新增 `createPackUpdateApi(deps)` 依赖注入入口；版本策略 / CurseForge / 默认配置语义不变
  - sfmc 保留薄封装注入 ROOT、i18n、theme、clack、logs

- Updated dependencies [c890a95]
- Updated dependencies [06e0f19]
- Updated dependencies [c890a95]
  - @sfmc-bds/bds-tools@0.2.0-beta.7

## 0.2.0-beta.4

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.6
  - @sfmc-bds/sdk@0.2.0-beta.5

## 0.2.0-beta.3

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.5
  - @sfmc-bds/sdk@0.2.0-beta.4

## 0.2.0-beta.2

### Patch Changes

- none
- Updated dependencies
  - @sfmc-bds/sdk@0.2.0-beta.3
  - @sfmc-bds/bds-tools@0.2.0-beta.4

## 0.2.0-beta.1

### Patch Changes

- a5ccbd3: fix(logs/config): BDS 级别解析 DRY 到 SDK；剥前缀后勿误判 Error；readJson 剥 BOM；log-filter 走 ensureSchemaConfig
- Updated dependencies [a5ccbd3]
  - @sfmc-bds/sdk@0.2.0-beta.1

## 0.2.0-beta.0

### Minor Changes

- 资源包管理强化与批量卸载/回收站；pack-update（CurseForge）；多语言 i18n；log 高亮；`mod` 别名；弃用 SEA；初始化与聚合包路径对齐。

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @sfmc-bds/bds-tools@0.2.0-beta.0
  - @sfmc-bds/sdk@0.2.0-beta.0
