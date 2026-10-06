SFMC Desktop **0.2.0**，Windows x64 正式版。

内置平台 **0.2.12**、Node.js 与 pnpm。

### 本次更新

- 左侧「开发工具 → UI Studio」内置界面编辑器，也可用 `Ctrl+9` 或命令面板打开。无需添加或连接实例，编辑器随客户端打包，可离线使用。
- 切换页面或实例后，当前工程、选中项与撤销记录仍然保留。
- 新建工程、重命名页面和自定义绑定改为编辑器内弹窗，修复 Electron 中无法输入和确认的问题。
- 桌面与 UI Studio 共用同一套颜色、字体、图标和控件；编辑器外观跟随桌面的浅色、深色或跟随系统。
- 浏览器里已有的 Studio 工程需先导出 ZIP，再导入桌面编辑器。编辑器不会自动改写服务器上的模块文件。

本发行使用 GitHub 构建证明和 SHA256 校验，Windows 程序未做 Authenticode 签名。客户端仍通过发行页手动下载安装更新。

### 下载与使用

1. 下载 `.exe` 安装，或完整解压 `.zip` 后运行 `SFMC Desktop.exe`。
2. 添加本机实例，选择 SFMC 部署根目录；SSH 实例填写主机、端口、用户、身份验证及远程根目录。
3. 已有部署先选择“仅查看”并核对接入计划；首次验收可在独立目录按引导初始化。
4. 在概览启动数据服务和 BDS，通过控制台与任务查看结果。关闭客户端不停止服务器。

[完整使用文档与截图](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页下方公示各文件 SHA256，`SHA256SUMS.txt` 提供可下载的校验清单。下载后在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.2.0-x64.exe' -Algorithm SHA256
```

使用 GitHub CLI 验证构建证明及来源标签：

```powershell
gh attestation verify '.\SFMC-Desktop-0.2.0-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref refs/tags/desktop-v0.2.0 --deny-self-hosted-runners
```

ZIP 使用相同命令替换文件名即可。`artifact-attestation.sigstore.json` 是可下载的证明材料，`release-manifest.json` 记录源码提交、平台版本和内置运行时信息。

### 更新与兼容

- 本版本通过发行页手动更新：退出客户端后覆盖安装或替换完整 ZIP 内容。服务器部署与数据独立于客户端目录。
- 接入现有部署不会自动切换活动平台。升级前按接入计划核对旧模块及平台兼容性。
- 平台 0.2.9 停用模块声明中的 `canDisable` 与 `enabledByDefault`；旧模块需移除这些字段。已有启停状态继续由 module-lock 保存。
- Linux 远程环境、游戏内表单与独立业务模块的完整流程仍需按实际环境验收。
