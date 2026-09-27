# SFMC 正式版行动计划

状态：执行中。本文记录发布门槛与证据；版本、运行状态和线上结果以执行当天的检查为准。

## 范围与顺序

1. 平台 monorepo 中所有公开的 `@sfmc-bds/*` 包，重点是 SDK、CLI、db-server、qq-bridge、bds-tools、devkit、create-module 和聚合包 `sfmc`。
2. `D:\WorkPlace\_proj\sfmc` 下的 19 个独立模块仓。保留各仓现有未提交改动，逐仓确认功能与发布内容。
3. 玩家运行环境中的部署包、BDS 日志和客户端行为。源码、npm 包与运行环境分别验收。

按依赖顺序发布：平台基础包 → 聚合包 → 官方模块 → 模块索引和文档。使用 pnpm 完成安装、检查、打包与发布；修正仓库内仍调用 npm 的自动化入口。版本号以各包现有语义化版本和实际兼容性决定，不把所有包强行统一为 `1.0.0`。

## 阶段一：冻结候选范围

- [ ] 记录各仓 HEAD、工作区差异、待消费 changeset、已发布版本和 npm dist-tag。
- [ ] 将未提交改动按功能分组；逐项决定纳入候选、延后或撤回，不覆盖无关改动。
- [ ] 记录模块与平台、Minecraft Script API、BDS 的依赖兼容矩阵。
- [ ] 确定首个正式版的各包版本与升级说明。

完成证据：每个公开包有候选提交或明确排除说明；候选源与构建源一致。

## 阶段二：标准项目与发布链检查

- [ ] 核对公开包的名称、版本、入口与 exports、files、许可、README、仓库与问题反馈地址、运行环境要求、依赖和 peerDependencies。
- [ ] 核对 pnpm 锁文件与可重复安装；CI 不隐式改锁或混用包管理器。
- [ ] 核对 pack 内容：源码与声明文件、可执行入口、默认配置和必要资源齐全，不含运行数据或凭据。
- [ ] 核对平台与模块的 CI、发布权限、Git tag、npm dist-tag、GitHub Release 和模块索引流程。
- [ ] 更新中英文安装、升级、发布和回退文档，移除过时的 beta-only 说明。

完成证据：在干净检出中用 pnpm 安装、构建、检查并验证打包内容；发布流程能生成可审查的候选版本。

## 阶段三：功能、升级与运行验收

- [ ] 对受影响包运行类型检查、构建、平台自检和相称的静态检查；确认 Windows 与 Ubuntu CI 通过。
- [ ] 用候选包在隔离的 SFMC_ROOT 中完成安装、初始化、模块安装、构建与加载演练。
- [ ] 对现有数据做备份、升级、恢复和回退演练，检查数据库迁移及配置兼容。
- [ ] 在目标 BDS 版本上检查部署包、重启后的新日志和客户端关键路径；运行中 BDS 的重启须先确认影响窗口。
- [ ] 记录所有未通过项及修复后的复验结果，不以静态构建代替运行验收。

完成证据：候选包、部署包和实际运行的版本可追溯；升级与回退均有成功记录。

## 阶段四：发布与复核

- [ ] 通过前三阶段后退出 Changesets `beta` 预发布模式，审查 Version PR 的版本与包间依赖。
- [ ] 按依赖顺序发布平台、聚合包和选定模块；核对 npm `latest`、Git tag、GitHub Release 和模块索引。
- [ ] 从公共 registry 进行全新 pnpm 安装，复验 CLI、模块安装和基本功能。
- [ ] 发布正式版公告，列明兼容范围、升级步骤、已知限制和回退版本。

完成证据：公共渠道可安装正式版，版本与产物一致，且发布后的最小验收通过。

## 当前基线（2026-09-27）

- 平台主仓 HEAD `fe453d4`，本轮工作区已有多项未提交改动；该提交的 `ootb` Windows/Ubuntu 和 `changeset-release` CI 成功。
- 平台仍在 Changesets `pre` / `beta` 模式；待消费 changeset 为 0。
- 19 个模块仓均有未提交改动。初查其中 17 个只替换 JSON Schema URL；`chat` 与 `qq-link` 有功能改动，需要单独审查。
- `chat`、`qq-link` 仍有 npm 驱动的脚本或 CI；pnpm 类型检查未真正运行，依赖准备分别被构建脚本许可和非交互目录确认挡住。

以上只是起点，不构成正式版验收结论。

## 执行记录（2026-09-27）

- 19 个模块仓已补齐 `license`、`repository`、`publishConfig` 和 `packageManager`；用 pnpm 锁文件替换了未改动的 npm 锁文件，CI 改用 pnpm；均新增或统一了先验证、打包、发布，再创建标签的发布工作流。模块索引登记仍需在发布阶段逐项完成。
- 平台发布辅助脚本的直接 `npx` / npm 调用已改为 pnpm；`create-module` 模板与两个公开包的仓库元数据已修正，并添加 changeset。相关包类型检查与 Changesets 状态检查通过。
- 19 个模块均已通过 pnpm 冻结安装、类型检查和 lint。`qq-link` 的旧管理 API 引用已移除，踢人路径改为服务端命令；该行为仍需在 BDS 中验收。
- `qq-link` 的现有测试在本机 Node 26 环境中因 `uv_os_get_passwd` 返回 `ENOMEM` 未运行成功，不能据此判定功能通过；需在目标 Node 22 CI 中复验。
- 公共 registry 查询时，`@sfmc-bds/sfmc` 与 SDK 的 `latest` 均为 `0.1.0`，beta 分别为 `0.2.0-beta.16` 与 `0.2.0-beta.18`；`create-module` 的 `latest` 仍指向 `0.1.0-beta.4`。正式发布后须复核这些 dist-tag。
- 19 个模块的发布工作流已通过 YAML 解析；发布阶段仍需实际 dry run、凭据可用性检查和远程 CI。现有两个模块的旧索引自动登记逻辑被统一工作流取代，发布后必须单独完成索引更新。
- 19 个模块均通过 pnpm 打包内容检查：包含 package.json、SAPI manifest、README、许可文件，未包含运行配置、数据或依赖目录。
- 平台 `pnpm run build`、`pnpm run lint`、`pnpm run typecheck`、`pnpm run verify` 和 9 个公开包的 pnpm 打包检查通过。`verify` 首次在隔离模拟目录清理时遇到沙箱 `EPERM`，在同一代码上使用所需文件权限复验通过 12/12。
- 后续复核发现 `@sfmc-bds/create-module` 漏在平台发布包清单之外，已纳入清单并添加 changeset；pnpm 打包检查现覆盖全部 9 个公开包。
- 本轮补齐了贡献指南、脚手架帮助和开发文档中的 npm 命令示例；`pnpm run typecheck` 通过，文档站以 `pnpm run docs build` 构建成功（跳过已有 TypeDoc 生成物）。
- 最终复核中，主仓 `pnpm run build` 与 `node packages/tools/pack-verify.mjs` 通过（9 个公开包）；`pnpm run lint` 通过且报告 35 条既有 warning、0 error。移除了未使用的 npm 子进程 helper。
- 主仓全量命令入口扫描已清除 npm/npx 安装或脚本替代示例，并修正英文文档、CLI 提示和排障指南。最新 `pnpm run typecheck`、`pnpm run build`、`pnpm run verify` 通过；集成自检 12/12。db-server 自检现使用仓库 `tmp/` 下的一次性隔离根目录与动态端口，不读写真实模块目录；模块接口断言按 catalog schema 移除了不存在的 `type` 字段。
- 对 19 个独立模块仓再次扫描后，README 与仓库生成器残留的安装/检查命令也已改为 pnpm；全部 19 个均有 `pnpm-lock.yaml`。
- CLI 的 registry 与 tarball 模块获取路径已从内部 npm 调用切换为 pnpm 临时安装后复制包文件；新增 Windows 子进程兼容依赖，关闭安装脚本和临时工作区 peer 自动安装。使用 `activity-log` 0.2.1 tarball 在隔离 SFMC_ROOT 中验证 tgz 路径与 registry 分支（以本地 tarball 模拟包来源），二者均完成配置播种、catalog/lock 更新及 `check-modules OK`。这不替代正式 registry 查询和 BDS 客户端运行验收。
- GitHub CLI 当前登录 token 无效（`gh auth status`）；远程推送、PR/CI 和发布工作流尚未验证或执行。
- 当前公共查询中 19 个 `@sfmc-bds/module-*` 包均未查到公开版本，需按首次发布准备 npm scope 权限与逐包登记。
- 目标 BDS 可执行文件版本为 `1.26.51.1`；检查时未发现运行中的 `bedrock_server` 进程。已有 staged 与部署聚合包的 Script API 依赖一致，`scripts/main.js` SHA256 一致，但它们不是本轮候选的新构建，不能代表新模块功能通过。

- 本轮最后一轮本地门禁复验：`pnpm run build`、9 个公开包的 `node packages/tools/pack-verify.mjs`、`pnpm run verify`（12/12）、`pnpm run docs build` 和 `pnpm exec changeset status` 均通过；lint 为 0 error、35 条既有 warning。`git diff --check` 有若干既存/生成 changelog 空白行提示，尚未为此做大范围格式改写。
- pnpm CLI 模块安装器已用 `activity-log` tarball 在隔离 SFMC_ROOT 中验证安装、配置播种、catalog/lock 更新及 `check-modules OK`；所谓 registry 分支是用本地 tarball 模拟来源，仍待公共 registry 实际安装复验。
- GitHub device login 已完成。在可访问系统凭据存储的执行环境中，`gh auth status` 确认以 `Tanya7z` 登录，主仓具备推送和管理权限；默认沙箱内的旧凭据报错不再视为远程操作阻断。当前仍处于 beta，不得跳过验收直接切正式版。
- 针对两个包含功能改动的模块补做复核：`chat` 的 pnpm 类型检查与 lint 通过；`qq-link` 的 pnpm 类型检查通过。其原有测试在 Node 24/26 均因本机 `os.userInfo()` 的 `uv_os_get_passwd ENOMEM` 无法启动；用仅作用于该次 Node 进程的兼容 preload 绕过系统用户名读取后，原有 3 项测试全部通过。该结果覆盖策略函数和 manifest 契约，不替代 BDS 里的入服门槛、绑定放行、踢人命令运行验收。
- 发布鉴权采用 GitHub Actions；本机 `pnpm login` / `pnpm whoami` 不是必要发布门禁。GitHub Secrets 清单已核实主仓有 `NPM_TOKEN` 和 `SFMC_GITHUB_TOKEN`（仅确认名称，未读取值）。主仓 Changesets workflow 可使用这些 secret 创建 Version PR 与发布平台包。
- 19 个独立模块仓的 GitHub Secrets 清单均无 `NPM_TOKEN`，而各仓当前 release workflow 在发布前要求它；因此模块独立发布通道尚不能使用。需在模块仓配置发布凭据，或完成并验证由主仓集中发布的工作流。现有 `id-token: write` 尚未接入 npm Trusted Publishing，不能当作已配置的无 token 发布通道。
- 主仓新增手动 `module-publish` 工作流：只接受 19 个已知模块、模块仓 `main` 上的完整提交 SHA 和与 `package.json` 一致的正式版本；默认只运行凭据、pnpm 检查与打包。dry run 会用主仓的 `NPM_TOKEN` 查询 npm 登录态，并核对 `SFMC_GITHUB_TOKEN` 对模块仓的推送权限；实际发布时再用它们发布 npm 包、创建标签与 Release。此流程尚待推送后的 dry run 和首包发布复验；各模块仓原有独立发布 workflow 仍依赖本仓未配置的 secret，应在集中发布路径验证后统一收敛。
- GitHub CLI 已完成 `workflow` scope 补充授权。主仓准备 PR #109 通过 Ubuntu/Windows CI 后合并，主仓 `module-publish` 工作流已在默认分支启用。`activity-log` 模块主分支提交 `35c33e4` 的集中发布 dry run 成功：npm 凭据、跨仓推送权限、pnpm 安装、类型检查、lint、既有测试与打包均通过；发布步骤按预期跳过。
- 18 个模块仓的 pnpm/CI 准备 PR 均通过各自 CI 并已合并。`qq-link` 暂未纳入：旧主分支使用当前 `@minecraft/server-admin` 已移除的 `dedicatedServer` 与 `kickPlayer`，类型检查失败；工作区中的新实现还需真实 BDS 验收。隔离检出的本机测试还遇到 Node 26 的 `uv_os_get_passwd ENOMEM`，不能把测试启动失败当作功能结果。
- 主仓隔离候选检出已退出 Changesets beta pre 模式，生成正式版候选：SDK/CLI/BDS 工具/db-server/QQ 桥接/聚合包/tools 为 `0.2.0`，eslint-plugin 为 `0.1.1`，create-module 为 `0.1.0`，devkit 为 `1.0.0`。同时修复 VS Code 扩展创建模块菜单的类型字段冲突。候选的 pnpm 安装、构建、整仓类型检查、lint（0 error）、平台 verify（12/12）与 9 包打包检查通过；聚合包 tgz 内部依赖均解析为 `0.2.0`。
- 正式版候选作为 Draft PR #111 提交，等待 CI 和运行验收。自动创建的 beta Version PR #110 不应合并；合并 #111 可能直接触发正式包发布，在部署、升级、回退与 BDS/客户端验收完成前保持 Draft。
- GitHub device login 过期后已重新授权；`gh auth status` 再次确认 `Tanya7z` 登录有效。Draft PR #111 的 Ubuntu、Windows smoke CI 均成功，保持 Draft 等待运行验收。
- `qq-link` 功能修复和 pnpm 发布准备已作为 Draft PR [Tanya7z/sfmc-module-qq-link#1](https://github.com/Tanya7z/sfmc-module-qq-link/pull/1) 提交，CI 成功，仍需真实 BDS 验收后合并。
- 模块索引仓已通过 [Tanya7z/sfmc-modules#1](https://github.com/Tanya7z/sfmc-modules/pull/1) 切换 pnpm 并合并；合并后的索引发布工作流成功。索引本地校验、26 项既有测试和 19 项构建成功；公共 registry 网络校验显示 19 个索引记录的精确版本全部为 HTTP 404，需先发布模块包再更新索引。
- 索引当前有 3 处版本差异：`activity-log` 和 `data-backup` 的索引为 `0.2.0`、候选包为 `0.2.1`；`qq-link` 的索引为 `0.2.0`、候选包为 `0.1.0`。正式发布模块后应按实际已发布版本修正，不能预先把未发布版本写成可安装。
- 当前公共 npm registry 尚无平台候选的精确正式版本；`@sfmc-bds/sfmc` 与 SDK 的 `latest` 仍为 `0.1.0`。平台发布、npm `latest`、全新公共安装和客户端验收仍未完成。
- 19 个模块的 `peerDependencies` 均接受候选 SDK `0.2.0`，未发现模块之间的直接 npm 依赖；模块发布顺序仍应排在 SDK 正式发布之后。模块开发依赖还锁在已存在的 SDK beta 区间，发布后可再逐仓切到正式 SDK 进行构建复验。
- VS Code 扩展的模块发布按钮已去掉 npm 回退，仅调用 pnpm；QQ 桥接入口的安装者提示也改为 pnpm。扩展类型检查和 QQ 桥接构建通过。
- 新建了与现有世界分离的 BDS `1.26.51.1` 测试目录和 SFMC_ROOT；用 `activity-log` 0.2.1 的本地 tarball 安装、构建并部署聚合包。新世界经 `packs doctor --fix` 开启 Beta APIs 后，BDS 日志确认行为包加载、模块启动和数据库请求成功。测试环境使用独立端口与数据文件；为绕过测试机的微软在线服务连接失败使用离线模式，因此此结果不覆盖正式服在线鉴权或客户端验收。
- 隔离运行首次发现：聚合行为包的 HttpDB 默认固定连接数据库端口 3001，未跟随 `configs/db_config.json#db_port`，导致测试包曾短暂连到本机已有数据库服务；测试服已立即关闭。候选已修复打包时注入配置端口并把端口纳入部署 catalog 比较，配置变更会触发重建。改用独立数据库后复验，BDS 日志确认连接到新端口并启动 `activity-log`；测试服务均已关闭。CLI 类型检查、构建和平台自检 12/12 通过。
- `qq-link` Draft PR #1 复核发现一条玩家可见的绑定错误文案被终端提示污染，现已修正；安装包也补齐 `configs-default/qq_link.json`，全新隔离安装能播种配置且 `check-modules OK`。候选包与 `activity-log` 一起在隔离 BDS 中完成启动，日志确认两个模块均已启用；没有玩家连接，因此绑定门槛、踢人和 QQ 实际投递仍待客户端与平台联调。`qq-link` 类型检查、lint（0 error）通过；原有 3 项测试在绕过本机 Node `os.userInfo()` 故障后通过，远程 Node 22 CI 成功。
- 对 19 个模块的 `configKey` 与 tarball 文件清单做了逐项检查：`coop` 是唯一缺少 `configs-default/<configKey>.json` 的模块。其空配置文件已通过 [Tanya7z/sfmc-module-coop#2](https://github.com/Tanya7z/sfmc-module-coop/pull/2) 合并；pnpm pack 确认文件进入 tarball，CI 成功。修复在隔离 worktree 中完成，未覆盖合作社仓库原工作区的界面改动。
- 模块 manifest 的运行依赖应按拓扑顺序安装：基础模块 `activity-log`、`area`、`chat`、`economy`、`inventory-switcher` 等先到位，再安装依赖它们的 `coop`、`land`、`qa`、`chat-sounds`、`clean`、`fly-area`、`gamemode-area`、`peace-area`。这是运行时 `requires` 关系；npm 包本身没有跨模块依赖。
