SFMC Desktop **0.3.1**，Windows x64 正式版。

内置平台 **0.2.12**、Node.js 与 pnpm。

### 本次更新

- 增加系统托盘。默认开启，可在侧栏「维护 → 设置」或命令面板「客户端设置」中关闭。
- 关闭窗口时默认留在托盘，不退出客户端，也不停止服务器。要退出，使用托盘菜单中的「退出」。
- 最小化到托盘默认关闭。
- 开机启动默认关闭。只有安装版会写入系统登录项。开机后隐藏窗口需要同时开启托盘和开机启动。

本发行使用 GitHub 构建证明和 SHA256 校验，Windows 程序未做 Authenticode 签名。客户端仍通过发行页手动下载安装更新。

### 下载与使用

1. 下载 `.exe` 安装，或完整解压 `.zip` 后运行 `SFMC Desktop.exe`。
2. 添加本机实例，选择 SFMC 部署根目录；SSH 实例填写主机、端口、用户、身份验证及远程根目录。
3. 已有部署先选择“仅查看”并核对接入计划；首次验收可在独立目录按引导初始化。
4. 在概览启动数据服务和 BDS，通过控制台与任务查看结果。关闭窗口默认留在托盘；退出请用托盘菜单。关闭客户端不停止服务器。

[完整使用文档与截图](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页下方公示各文件 SHA256，`SHA256SUMS.txt` 提供可下载的校验清单。下载后在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.1-x64.exe' -Algorithm SHA256
```

使用 GitHub CLI 验证构建证明及来源标签：

```powershell
gh attestation verify '.\SFMC-Desktop-0.3.1-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref refs/tags/desktop-v0.3.1 --deny-self-hosted-runners
```

ZIP 使用相同命令替换文件名即可。`artifact-attestation.sigstore.json` 是可下载的证明材料，`release-manifest.json` 记录源码提交、平台版本和内置运行时信息。

### 更新与兼容

- 本版本通过发行页手动更新：从托盘退出客户端后覆盖安装，或替换完整 ZIP 内容。服务器部署与数据独立于客户端目录。
- 从 0.2.0 升级后，关闭窗口不再直接退出。需要退出时使用托盘菜单中的「退出」，或在客户端设置里关闭「关闭时留在托盘」。
- 接入现有部署不会自动切换活动平台。升级前按接入计划核对旧模块及平台兼容性。
- 平台 0.2.9 停用模块声明中的 `canDisable` 与 `enabledByDefault`；旧模块需移除这些字段。已有启停状态继续由 module-lock 保存。
- Linux 远程环境、游戏内表单与独立业务模块的完整流程仍需按实际环境验收。
