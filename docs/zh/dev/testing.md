# 测试与调试策略

在 Minecraft 基岩版 SAPI 生态中，“如何兼顾开发迭代速度与真机运行保真度”历来是一大痛点。SFMC 经过深度架构演进，确立了务实高效的**双轨测试策略（Dual-Track Strategy）**：

- **业务模块作者轨**：彻底摒弃易产生“本地全过、真机崩溃”的笨重 Mock 假引擎，转向**「严格静态检查 + VS Code 扩展 Watch 毫秒热部署 + 原生 BDS 真机联调」**。
- **平台核心贡献轨**：基于 Node.js 原生 `node:test` 框架，为数据库、通信桥与构建工具链构建严密的单元与集成测试网。

---

## 1. 为什么告别假引擎沙箱？

在早期版本中，社区常试图在 Node.js 中使用 Mock 对象模拟 `@minecraft/server` 原生对象。但在工程实践中暴露了致命缺陷：
1. **Mojang API 行为漂移**：官方 SAPI 每月迭代，事件触发顺序、异常抛出逻辑、实体生命周期等内部细节在 Node 中无法 100% 仿真。
2. **调试信心受挫**：开发者花费大量精力编写 Mock 测试，最终却仍因真机版本微调而产生非预期故障。

因此，自新版起，SFMC 全面废弃旧版 Node 假引擎沙箱（代码已归档于 `_sandbox_archive/`，SDK 亦不再导出 `./testing`），以真实、极速的**原生热重载（Watch & Hot-Reload）**取而代之。

---

## 2. 模块作者：极速闭环开发矩阵

模块作者在日常编码与验证时，推荐遵循“静态先行、真机终验”原则：

```mermaid
flowchart LR
  Code[编写 TypeScript 源码] --> Lint[1. 静态检查<br/>typecheck & lint]
  Lint -->|无语法与规范错误| Watch[2. 触发扩展 Watch<br/>毫秒级增量打包]
  Watch --> Deploy[3. 自动注入 BDS 世界]
  Deploy --> Live[4. 真机热重载<br/>观察 BDS 实时日志]
```

| 阶段 / 手段 | 执行命令 / 动作 | 核心目标与检验场景 |
| :--- | :--- | :--- |
| **类型安全核验** | `pnpm run typecheck` | 利用官方 `@minecraft/*` 与 `@sfmc-bds/sdk` 的 `.d.ts` 强类型约束，在编译期捕获绝大多数参数拼写与空指针隐患。 |
| **规范静态扫描** | `pnpm run lint` | 激活 `@sfmc-bds/eslint-plugin` 专属规则，拦截直接调用 `sendMessage`、违规私跨模块源码引用等反模式。 |
| **源码实时监视** | 扩展命令：`SFMC: Start Watch` | 监听 `sapi/src/` 源码变动，由 `@sfmc-bds/devkit` 增量转译并自动替换世界行为包文件。 |
| **即时行为重载** | 扩展：`SFMC: Reload to BDS`<br/>或终端：`sfmc mod reload` | 向 BDS 发出 `/reload` 指令，在不重启服务器、不断开连接的情况下立竿见影检验指令与 UI 效果。 |
| **运行时观测** | 查看 BDS 控制台或 `logs/bds.log` | 确认权限注册输出、聊天命令回调、数据库查询耗时与逻辑日志。 |

### 本地环境 vs 真机 BDS 职责划分

| 优先在本地编辑器完成 | 必须在真实 BDS 中验证 |
| :--- | :--- |
| 变量类型检查、方法签名推导 | 复杂的方块交互、红石时序、实体 AI |
| 模块 `manifest.json` 格式合规性 | 表单 UI（ActionFormData / ModalFormData）渲染与交互 |
| 纯业务算法（数据计算、文本清洗） | 与 Minecraft 游戏特定版本的真实渲染与网络同步表现 |

---

## 3. 平台核心包：`node:test` 单测矩阵

主仓平台级组件（如数据持久化中枢、QQ 网关与附加包解析引擎）具备确定性的 Node 运行环境，全面采用原生 `node:test` 进行严格回归测试。平台贡献者可按包分别运行：

```bash
# 测试 SQLite 数据持久化中枢
pnpm -F @sfmc-bds/db-server test

# 测试 QQ 开放平台与 OneBot 桥接网关
pnpm -F @sfmc-bds/qq-bridge test

# 测试 BDS 自动更新与附加包引擎
pnpm -F @sfmc-bds/bds-tools test

# 测试 CLI 编排与模块安装器
pnpm -F @sfmc-bds/cli test

# 测试 SDK 基础契约与工具链
pnpm -F @sfmc-bds/sdk test
cd packages/tools && pnpm test
```

### 平台测试工程规约

1. **测试文件组织**：测试用例采用 `*.test.ts` 命名，与源码同级放置或存放于各子包的 `test/` 目录下。
2. **构建一致性**：大多数平台包采用“先 `build` 转译至 `dist/`，再对最终制品运行测试”的模式，确保与实际发布至 npm 后的运行表现 100% 一致。
3. **CI 自动化门禁**：GitHub Actions 工作流 `ootb.yml` 在每次提交流水线中均会自动跑通所有子包单元测试，并执行全仓冒烟自检（`verify`），坚决杜绝衰退缺陷（Regression）。

---

## 4. 推荐编辑器配置（Cursor / VS Code）

模块作者在打开作者独立仓时，推荐通过工作区进行无缝联动：

1. **配置运行根目录**：在 `.vscode/settings.json` 中配置 `"sfmc.root": "D:/path/to/my-minecraft-server"`，指定你正在运行的本地测试服务端目录。
2. **快捷命令面板**：按下 `Ctrl + Shift + P` 输入 `SFMC`，即可一键使用：
   - `SFMC: Link to SFMC Root`（建立软链接）
   - `SFMC: Start Watch`（启动增量监视构建）
   - `SFMC: Reload to BDS`（触发游戏热更新）
