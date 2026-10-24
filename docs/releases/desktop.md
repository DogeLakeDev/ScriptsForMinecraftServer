SFMC Desktop **0.3.8**，Windows x64 正式构建。

内置平台仍是已发布的 **0.2.20**、Node.js 与 pnpm。本版只更新桌面界面，不发布新的平台包。

### 本次更新

- 首页「实例状态」重新排版：顶部一行显示运行服务、在线玩家、TPS 和主机内存，TPS 偏低时标黄；服务表与「需要关注」并排，「需要关注」列出最近告警和任务；实例详情移到服务卡底部；运行曲线横跨整行。
- 移除右侧告警与任务栏，相关内容合并到首页「需要关注」，顶栏不再有动态栏开关。
- 侧栏名称精简为实例状态、控制台、任务、模块、资源包；对话框、提示和确认框的说明文字一并精简。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.8-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. 已有服务器继续使用平台 0.2.20，不需要为这个桌面版本升级平台。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.8-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.8-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.8' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本与内置平台版本。
