# 测试与调试策略

在 SFMC 体系中，测试与验证策略秉持“开发效率与运行保真度并重”的原则，针对业务模块与平台底层划分出清晰的分轨：

- **业务模块作者轨**：采用**「TypeScript 静态类型检查 + ESLint 规范扫描 + 专属扩展 Watch 毫秒级增量热部署」**，在真实的 BDS 服务端环境中进行高保真闭环联调。
- **平台核心贡献轨**：基于 Node.js 原生 `node:test` 框架，为数据库中枢、通信网关与构建打包管线构建严密的自动化单元测试与回归测试网。

## 1. 模块作者：极速开发与联调闭环

模块作者在日常编码与验证业务逻辑时，遵循“静态先行、真机终验”的开发节奏：

```mermaid
flowchart LR
  Code[编写 TypeScript 源码] --> Lint[1. 本地静态检查<br/>typecheck & lint]
  Lint -->|无类型与规范错误| Watch[2. 扩展 Watch 监听<br/>毫秒级增量构建]
  Watch --> Deploy[3. 自动同步至 BDS 世界]
  Deploy --> Live[4. 真机热重载<br/>观察 BDS 实时日志]
```

| 验证阶段 | 执行方式 | 核心目标与检验场景 |
| :--- | :--- | :--- |
| **类型安全检查** | `pnpm run typecheck` | 利用官方 `@minecraft/*` 与 `@sfmc-bds/sdk` 的 `.d.ts` 声明文件，在编译期捕获参数拼写、空指针与返回值类型不匹配。 |
| **规范静态扫描** | `pnpm run lint` | 激活 `@sfmc-bds/eslint-plugin` 专属规则集，拦截直接调用 `sendMessage`、跨模块非法相对引用等反模式。 |
| **源码实时监视** | 扩展命令：`SFMC: Start Watch` | 监听 `sapi/src/` 目录源码变动，由 `@sfmc-bds/devkit` 增量转译并自动替换世界行为包中的脚本文件。 |
| **即时行为重载** | 扩展：`SFMC: Reload to BDS`<br/>或控制台：`sfmc mod reload` | 向 BDS 发出 `/reload` 指令，在不重启服务器、不断开玩家连接的情况下立竿见影检验命令与 UI 表单。 |
| **运行时日志观测** | BDS 控制台或 `logs/bds.log` | 实时观测权限注册输出、聊天命令回调、数据库事务耗时与业务异常堆栈。 |

### 本地编辑器与真机 BDS 职责划分

| 优先在本地编辑器完成 | 必须在真实 BDS 环境中验证 |
| :--- | :--- |
| 变量类型检查、函数签名推导与语法校验 | 复杂的方块交互、红石逻辑时序与实体行为 AI |
| 模块 `manifest.json` 契约合规性 | 表单 UI（ActionFormData / ModalFormData）真实渲染与点击响应 |
| 纯业务算法（数值结算、文本清洗） | 与 Minecraft 真实版本客户端的渲染表现与网络同步状态 |

## 2. 平台核心包：`node:test` 自动化单测矩阵

平台级核心组件（如持久化中枢、QQ 网关与附加包解析引擎）具备确定性的 Node.js 运行环境，全面采用原生 `node:test` 进行严格的自动化测试：

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
3. **CI 自动化门禁**：GitHub Actions 工作流 `ootb.yml` 在每次提交流水线中均会自动跑通所有子包单元测试，并执行全仓冒烟自检（`verify`），杜绝衰退缺陷。

## 3. 编辑器专属扩展（Cursor / VS Code）

模块开发者在打开模块独立仓时，推荐通过官方配套扩展进行无缝联动：

1. **配置运行根目录**：在 `.vscode/settings.json` 中配置 `"sfmc.root": "D:/path/to/my-minecraft-server"`，指向你的本地测试服务端目录。
2. **快捷命令面板**：按下 `Ctrl + Shift + P` 输入 `SFMC`，即可一键使用：
   - `SFMC: Link to SFMC Root`（建立软链接挂接）
   - `SFMC: Start Watch`（启动增量监视构建）
   - `SFMC: Reload to BDS`（触发游戏热更新）
