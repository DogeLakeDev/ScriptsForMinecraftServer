SFMC Desktop **0.3.6(1)**，Windows x64 正式构建。

本次保留产品版本 0.3.6，构建号为 1。内置平台 **0.2.20**、Node.js 与 pnpm。今后同类小修复仅递增构建号。

### 本次修复

- 配置列表的文件名与路径单行省略，悬停可查看完整路径，修复异常换行、越界和横向滚动。
- 配置保存只写入文件，不自动停止或重启服务；旁边提供独立的重启服务按钮。
- 模块安装、启停、卸载及世界包导入、启停不自动停服或重启，页面提供独立的重启 BDS 按钮。
- 手动重启只处理当前运行的服务；下次启动也会读取最新配置，并保留服务状态订阅。
- 修复弹窗表单的下拉选项被遮挡、不可点击的问题。
- 取消维护任务及平台升级前的自动全量快照，在「更新与备份」提供手动备份按钮；恢复备份时不再额外生成快照。
- 手动备份会短暂停服，结束后恢复原先运行的服务；复制失败时清理本次不完整快照。
- 构建号纳入客户端更新检查，关于与更新日志显示 0.3.6(1)。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.6(1)-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. **已有服务器请在「更新与备份」页升级平台到 0.2.20，再重新连接。** 仅替换客户端不会更新已经运行的后台。平台更新属于显式维护操作，会按页面提示停止并恢复服务。
4. 旧平台在配置、模块和世界包页面只允许查看，避免旧后台仍自动停服；更新平台后开放编辑与手动重启。
5. 新客户端支持同一产品版本内的构建更新检查。旧版客户端可能无法识别构建标签，可直接从本发行页下载安装。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.6(1)-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.6(1)-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.6+build.1' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本、构建号与内置平台版本。
