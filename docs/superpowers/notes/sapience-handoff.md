# Sapience 迁仓交接

**日期：** 2026-08-01  
**用途：** 把本对话中的决策与续作路径带到 **独立 Sapience 仓库**；Cursor 聊天记录本身不能 `git push`。

---

## 1. 对话搬不走什么 / 能带走什么

| 带不走 | 能带走 |
|--------|--------|
| Cursor 本线程的完整聊天气泡（存在本机项目下的 agent-transcripts） | 已写入的规格与交接文档 |
| 视觉伴侣临时服务进程 | `.superpowers/brainstorm/` 里已保存的线框 HTML（若拷贝） |
| 未提交的本地扩展草稿（若已 reset 则无） | 下文「决策摘要」与旧会话 UUID |

旧会话 transcript（本机，勿当机密外传）：  
`agent-transcripts/aa126d7f-9917-4134-a0b4-fe068f3522e8`（欠费前沙箱 UI）  
以及本线程所在项目的后续 transcript（迁仓后仍可在旧项目路径打开查阅）。

---

## 2. 推荐迁法（可行、稳）

### 步骤 A — 建独立仓

建议路径示例：`D:\#WorkPlace\#MCBEProjects\Sapience`

```text
1. 新建空目录 + git init（或 GitHub 空仓后 clone）
2. 拷贝至少：
   - docs/superpowers/specs/2026-08-01-sapience-design.md
   - docs/superpowers/notes/sapience-handoff.md
3. 在 Cursor：File → Open Folder → 打开 Sapience 仓
   （或让 Agent 调 create_project + move_agent_to_root）
4. 新开一条 Agent 对话，第一条消息：
   「按 @docs/.../2026-08-01-sapience-design.md 与
    @docs/.../sapience-handoff.md 继续；下一步写实现计划 / 搭 Tauri 骨架」
```

**同一条旧对话**也可以在切根后继续，但工具默认工作区会变；为免混仓改文件，**更稳的是新开对话 + @ 规格**。

### 步骤 B — 从 SFMC 复用代码（稍后）

不要整仓搬 `extensions/sfmc-module`。按需抽：

- UI 可参考：`extensions/sfmc-module/src/playground/graph-ui/`（将重写成 Tailwind DS）
- 宿主协议可参考：`hostClient.ts` + SDK `testing/playground-host`
- 依赖：`@sfmc-bds/sdk`（或日后抽更薄的 sapi-runtime 包）用 npm workspace / 文件依赖连过来

### 步骤 C — SFMC 侧残留

- 规格副本可继续留在 SFMC docs 作史  
- 扩展内 Webview Playground / Run Module Tests / 启动并调试：**已移除**；可选「打开 Sapience」桥后置  

---

## 3. 决策摘要（给新对话用）

- **产品名：** Sapience  
- **独立桌面应用**；Tauri 壳；用户自备 Node；host = **stdio** JSON-RPC  
- **通用 SAPI：** 任意 `@minecraft/server` 入口工程；SFMC = 适配器  
- **UI：** React + xyflow + Tailwind + Zustand + RHF + Radix；Blender 向强致敬 DS  
- **布局：** Tool（可关）| Outliner（场景/图/夹具）| Graph | Properties（左图标页签）| 底 Console（loglevel）  
- **操作：** 添加菜单 + 工具条 + 右键，同一命令表  
- **不做：** Electron 默认方案；Node SEA；首版 Recharts  

权威细节：`docs/superpowers/specs/2026-08-01-sapience-design.md`。

---

## 4. 新对话建议首令

```text
阅读 Sapience 设计规格与本 handoff。
下一步：用 writing-plans 写 Tauri + Vite 骨架与目录规划的实现计划
（独立仓内；不要改 SFMC 扩展当主路径）。
```
