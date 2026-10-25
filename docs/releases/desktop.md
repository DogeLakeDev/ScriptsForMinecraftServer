SFMC Desktop **0.3.8(1)**，Windows x64 正式构建。

本次保留产品版本 0.3.8，构建号为 1。内置平台 **0.2.21**、Node.js 与 pnpm。

### 本次更新

- 微调配色。
- 内存页列出主机、SFMC 合计，以及正在运行的守护进程、QQ 桥、隧道、LLBot 和附属进程。合计是这些进程的工作集相加。已有服务器仍由当前数据服务上报；旧数据服务只包含 BDS 和数据服务。
- 添加实例时可以选择管理网关，地址和访问令牌与小程序相同。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.8-build.1-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. 已有服务器不需要为了安装这个客户端而升级平台。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.8-build.1-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.8-build.1-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.8+build.1' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本、构建号与内置平台版本。
