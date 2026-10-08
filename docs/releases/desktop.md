SFMC Desktop **0.3.5**，Windows x64 正式版。

内置平台 **0.2.16**、Node.js 与 pnpm。

### 本次更新

- 打开实例后直接管理，不再要求确认接入。空目录仍进入一次初始化。
- 平台 0.2.16 起，断开桌面或 SSH 管理连接不会停止服务器进程。
- 运行指标写入数据库。服务未运行时仍可查看已有曲线，并增加「一天」范围。
- 玩家页的允许名单展示绑定记录：玩家名、XUID、QQ 通道和绑定时间。名单只读。
- 日志控制台按与命令行相同的规则高亮关键词。
- 平台更新在日志文件可以继续写入后再验证，避免 Windows 上文件仍被占用时回滚。
- 控制台关闭自动换行时可以横向滚动。实例状态灯移到侧栏右侧。

本发行使用 GitHub 构建证明和 SHA256 校验，Windows 程序未做 Authenticode 签名。客户端仍通过发行页手动下载安装更新。

### 下载与使用

1. 下载 `.exe` 安装，或完整解压 `.zip` 后运行 `SFMC Desktop.exe`。
2. 添加本机实例，选择 SFMC 部署根目录；SSH 实例填写主机、端口、用户、身份验证及远程根目录。
3. 已有部署保存后直接管理；首次验收可在独立目录按引导初始化。升级平台在更新页进行。
4. 在概览启动数据服务和 BDS，通过控制台与任务查看结果。关闭窗口默认留在托盘；退出请用托盘菜单。关闭客户端不停止服务器。

[完整使用文档与截图](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页下方公示各文件 SHA256，`SHA256SUMS.txt` 提供可下载的校验清单。下载后在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.5-x64.exe' -Algorithm SHA256
```

使用 GitHub CLI 验证构建证明及来源标签：

```powershell
gh attestation verify '.\SFMC-Desktop-0.3.5-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref refs/tags/desktop-v0.3.5 --deny-self-hosted-runners
```

ZIP 使用相同命令替换文件名即可。`artifact-attestation.sigstore.json` 是可下载的证明材料，`release-manifest.json` 记录源码提交、平台版本和内置运行时信息。

### 更新与兼容

- 本版本通过发行页手动更新：从托盘退出客户端后覆盖安装，或替换完整 ZIP 内容。服务器部署与数据独立于客户端目录。
- 从 0.3.1 升级后，关闭窗口仍默认留在托盘。需要退出时使用托盘菜单中的「退出」。
- 内存曲线在平台 0.2.16 起写入数据库，服务停止后仍可查看。尚未升级的服务器，只在打开概览期间累积本次采样。
- 绑定名单和「断开连接后服务器继续运行」需要把实例平台升到 0.2.16。只更换桌面客户端不会改服务器上已安装的平台。
- 模块更新会跳过 monitor 等已收编模块，并在界面显示「已收编至平台」。
- 打开已有部署不会自动切换活动平台。升级前在更新页核对兼容性。
- 平台 0.2.9 停用模块声明中的 `canDisable` 与 `enabledByDefault`；旧模块需移除这些字段。已有启停状态继续由 module-lock 保存。
- Linux 远程环境、游戏内表单与独立业务模块的完整流程仍需按实际环境验收。
