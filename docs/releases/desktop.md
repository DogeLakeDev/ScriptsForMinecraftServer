SFMC Desktop **0.3.7**，Windows x64 正式构建。

内置平台仍是已发布的 **0.2.20**、Node.js 与 pnpm。本版不发布新的平台包。

### 本次更新

- 可安装模块的卡片可以打开详情，查看名称、说明和版本。
- 告警按来源、级别和正文保存，可搜索、筛选、复制、忽略，并从告警跳到日志。
- 日志控制台增加按本地日期和时间筛选、删除落盘日志。世界包增加图标、卸载，以及拖入多个文件导入。备份可以删除。模块索引若带有依赖名单，未安装或未启用的依赖会阻止安装并给出下一步。
- 上面这些新的后台能力要等守护进程宣告后才会打开。连接已发布的 0.2.20 时，日志仍读取最近记录，世界包和备份保持原有操作，模块安装也不因缺少依赖名单而停止。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.7-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. 已有服务器继续使用平台 0.2.20，不需要为这个桌面版本升级平台。
4. 新客户端可以识别 0.3.6 的构建更新。更早的客户端请从本发行页下载安装。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.7-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.7-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.7' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本与内置平台版本。
