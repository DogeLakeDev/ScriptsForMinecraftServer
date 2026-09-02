# 控制台命令全景速查

在 `sfmc` 交互式终端（REPL）或系统 Shell 环境下，可使用下列指令进行服务管控、模块编排与扩展包管理。

在交互终端中，输入 `help` 可列出当前上下文支持的全部命令；输入 `/` 可激活交互式命令补全菜单。

:::tip 命令别名约定
模块管理：`mod` ≡ `module`（顶层短命令 `install` / `uninstall` / `search` / `list` 等同于 `mod <cmd>`）
附加包管理：`packs` ≡ `addon`
详细执行机制请分别查阅：[服务管理](./services.mdx)、[模块管理](./modules.mdx)、[附加包管理](./addons.md)。
:::

## 1. 伴生服务编排（Service Management）

| 命令与常用参数 | 典型示例 | 功能与行为说明 |
| :--- | :--- | :--- |
| `status` | `sfmc> status` | 查看所有伴生服务（db / qq / bds）的运行状态、PID 与内存占用。 |
| `start <svc\|-all>` | `sfmc> /start -all`<br/>`sfmc> start db` | 启动全部服务或指定子服务（可选：`db`、`qq`、`llbot`、`bds`、`-all`）。自动执行依赖自检与装载闸门。 |
| `stop <svc\|-all>` | `sfmc> stop bds` | 安全平滑停止指定服务或终止所有进程（`-all`）。 |
| `restart <svc\|-all>` | `sfmc> restart qq` | 重新启动指定服务。常用于修改了 `qq_config.json` 或 `db_config.json` 后热重启。 |
| `logs <svc> [-n N] [-f]` | `sfmc> logs bds -f`<br/>`sfmc> logs db -n 50` | 实时查看或追踪指定服务的运行日志。在交互终端中亦可随时按下快捷键 `Ctrl + L` 或 `Tab` 快速切换日志源。 |
| `send <svc> <input>` | `sfmc> send bds op Alex` | 向指定服务的子进程标准输入（stdin）注入字符指令（仅在交互式 REPL 中有效）。 |
| `init` | `sfmc> init` | 重新唤起首次开服交互式初始化向导（需在标准 TTY 终端中运行）。 |
| `update [--check-only]` | `sfmc> update` | 检查并升级 Bedrock Dedicated Server 官方服务端。使用 `--check-only` 仅查询版本不下载。 |

## 2. 功能模块管控（Module Management）

| 命令与常用参数 | 典型示例 | 功能与行为说明 |
| :--- | :--- | :--- |
| `mod search [keyword]` | `sfmc> mod search economy` | 在官方 `sfmc-modules` 索引库中模糊检索可用功能模块。 |
| `mod info <id>` | `sfmc> mod info afk` | 查看指定模块的作者、版本号、描述与依赖项清单。 |
| `mod install <id...> [--from <src>] [--link]` | `sfmc> mod install afk`<br/>`sfmc> mod install my-mod --from dir:../my-mod --link` | 下载并安装模块到 `modules/packages/`。支持从本地目录挂接（`--link` 软链调试）。 |
| `mod uninstall <id...>` | `sfmc> mod uninstall afk` | 卸载指定模块并清理其源码文件。 |
| `mod list` | `sfmc> mod list` | 列出本地所有已安装模块及其在 `module-lock.json` 中的启停状态。 |
| `mod enable <id...>` | `sfmc> mod enable afk` | 激活指定模块。写入 `module-lock.json`，若 db-server 在线则同步热推内存态。 |
| `mod disable <id...>` | `sfmc> mod disable afk` | 禁用指定模块。禁用后下次组装行为包时将自动排除该模块。 |
| `mod verify` | `sfmc> mod verify` | 校验本地所有模块的 `manifest.json` 契约合规性与依赖完整度。 |
| `mod build` | `sfmc> mod build` | 仅执行动态组装与编译，将启用的模块编译至 `packs/_build/` 暂存区。 |
| `mod reload [--build-only]` | `sfmc> mod reload` | 编译、组装并部署至当前世界目录，同时向 BDS 发起重载请求（日常联调核心命令）。 |

:::info 模块开发者注意
自新版起，模块作者向的本地单测、文件监视（Watch）与发布已统一收敛至 VS Code / Cursor 专属扩展 **「SFMC Module」**；CLI 不再提供旧版 `mod test`、`mod watch` 与 `mod publish` 命令。详见 [模块开发指南](../dev/module-author.mdx)。
:::

## 3. 第三方附加包（Add-ons & Packs）

| 命令与常用参数 | 典型示例 | 功能与行为说明 |
| :--- | :--- | :--- |
| `packs scan [--force] [--dry-run]` | `sfmc> packs scan` | 扫描 `<SFMC_ROOT>/packs/` 收件箱中的待装包，自动解析并安装入世界。 |
| `packs list [--kind bp\|rp\|all]` | `sfmc> packs list --kind bp` | 列出当前游戏世界中已激活的所有第三方行为包（BP）与资源包（RP）。 |
| `packs install <path\|--inbox> [--force]` | `sfmc> packs install ./cool.mcpack` | 直接安装指定物理路径下的附加包或处理收件箱归档。 |
| `packs enable <uuid\|folder>` | `sfmc> packs enable my-addon` | 在当前世界中启用指定附加包（支持使用 UUID 或文件夹名）。 |
| `packs disable <uuid\|folder>` | `sfmc> packs disable my-addon` | 在当前世界中停用指定附加包。 |
| `packs uninstall <id...> [--purge]` | `sfmc> packs uninstall my-addon` | 将附加包移出世界目录（默认移至 `packs/_trash/` 回收站；`--purge` 永久销毁）。 |
| `packs search <keyword>` | `sfmc> packs search "Vehicles"` | 在 CurseForge 基岩版资源库中远程搜索附加包项目。 |
| `packs bind <id> <slug>` | `sfmc> packs bind my-addon vehicle-pack` | 将已安装的本地附加包与 CurseForge 项目 slug 建立版本更新追踪绑定。 |
| `packs unbind <id>` | `sfmc> packs unbind my-addon` | 解除本地附加包与远端更新源的绑定。 |
| `packs sources` | `sfmc> packs sources` | 查看所有已登记的更新源映射表。 |
| `packs check` | `sfmc> packs check` | 检查所有已绑定的附加包是否有远端新版本发布。 |
| `packs update [--all]` | `sfmc> packs update --all` | 下载并升级所有已绑定的第三方附加包到最新版本。 |
| `packs bump <id>` | `sfmc> packs bump my-addon-rp` | 仅针对资源包（RP）：将其 patch 版本号 +1，强制客户端拉取最新贴图缓存。 |
| `packs doctor` | `sfmc> packs doctor` | 扫描并排查世界清单中损坏或游离的无效附加包引用。 |
| `packs path` | `sfmc> packs path` | 打印当前世界行为包与资源包的落盘文件系统路径。 |

## 4. 全局通用与诊断命令（General & Diagnostics）

| 命令 | 说明与行为 |
| :--- | :--- |
| `help [command]` | 打印全局帮助手册或指定命令的参数详解。 |
| `version` | 打印当前 SFMC CLI、Node.js 运行时及 SDK 的构建版本信息。 |
| `locale [lang]` | 切换或查看交互式终端界面语言（如 `zh` 或 `en`）。 |
| `quit` / `exit` | 平稳退出当前的交互式 REPL 控制台（后台服务将继续保持运行）。 |
| `debug <subcommand>` | 开发者专用底层诊断工具，用于查看内部状态树与事件流。 |
