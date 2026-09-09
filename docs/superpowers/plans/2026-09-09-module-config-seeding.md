# Module Config Seeding Implementation Plan

> **For agentic workers:** Prefer subagent-driven-development (task-by-task + reviews).
> Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 模块安装、更新或 link 后，自动创建并安全补全 \`configs/<configKey>.json\`。

**Architecture:** 以模块包内 \`configs-default/<configKey>.json\` 为唯一默认配置源，在 CLI \`afterInstall\` 更新 catalog/lock 前完成校验与递归补缺。核心合并和原子写入放入独立 helper；脚手架、静态检查和文档统一到同一路径约定。

**Tech Stack:** Node.js 22+、ES modules、TypeScript/JavaScript、Node test runner、Changesets。

**Spec:** \`docs/superpowers/specs/2026-09-09-module-config-seeding-design.md\`

---

### Task 1: 实现默认配置播种内核

**Files:**

- Create: \`packages/cli/scripts/module-install/lib/config-seeding.mjs\`
- Create: \`packages/cli/scripts/module-install/test/config-seeding.test.ts\`

- [ ] **Step 1: 先写递归补缺测试**

覆盖：保留已有标量、数组和未知字段；递归补充缺失对象字段；不修改输入对象；新增点路径按字典序返回。

- [ ] **Step 2: 实现 \`mergeMissing(current, defaults)\`**

只递归 plain object；数组、null 和标量均为原子值。返回 \`{ value, addedPaths }\`。

- [ ] **Step 3: 先写文件播种测试**

覆盖目标不存在、目标无变化、递归补缺、默认 JSON 损坏、用户 JSON 损坏、顶层非对象、非法 configKey、路径穿越和默认文件缺失。损坏用户文件的测试须比较操作前后原始字节一致。

- [ ] **Step 4: 实现 \`seedModuleConfig(options)\`**

返回状态 \`created | updated | unchanged | missing-defaults\`、目标路径和新增点路径。源必须位于模块根目录，目标必须位于 SFMC 工作根目录。写入使用同目录唯一临时文件加原子 rename；失败时清理临时文件且不触碰原目标。

- [ ] **Step 5: 验证 helper**

Run: \`node --test --import tsx/esm "packages/cli/scripts/module-install/test/config-seeding.test.ts"\`  
Expected: 全部通过，0 fail。

### Task 2: 接入全部模块安装来源

**Files:**

- Modify: \`packages/cli/scripts/module-install/fetch-module.mjs\`
- Modify: \`packages/cli/scripts/module-install/test/install-resolver.test.ts\`
- Modify: \`packages/cli/scripts/module-install/test/link-local.test.ts\`
- Modify: \`packages/cli/scripts/module-install/test/local-resolver.test.ts\`

- [ ] **Step 1: 先写安装边界测试**

断言播种发生在 catalog/lock 写入前；播种硬失败时不产生新的 catalog/lock 状态。覆盖 copy/zip 与 link，确认 link 只读源模块仓。

- [ ] **Step 2: 在 \`afterInstall\` 调用播种 helper**

从已安装 manifest 读取 configKey。播种成功或返回 missing-defaults 后，才执行 catalog/lock 更新。npm、tgz/zip、dir、link 都必须走该入口。

- [ ] **Step 3: 添加稳定日志**

输出 created、updated（含排序后的点路径）、unchanged 或 missing defaults，并使用相对 SFMC 工作目录的路径。

- [ ] **Step 4: 验证安装器**

Run: \`node --test --import tsx/esm "packages/cli/scripts/module-install/test/**/*.test.ts"\`  
Expected: 全部通过，0 fail。

### Task 3: 扩展 check-modules 配置契约

**Files:**

- Modify: \`packages/cli/scripts/module-install/check-modules.mjs\`
- Create: \`packages/cli/scripts/module-install/test/check-modules-config.test.ts\`

- [ ] **Step 1: 写配置契约测试**

覆盖标准文件合法、缺失默认文件仅警告、同目录错名 JSON、损坏 JSON、顶层非对象。

- [ ] **Step 2: 增加结构化 warnings**

保持现有 \`{ ok, error, summary }\` 契约并增加 warnings。默认文件缺失返回 warning；文件存在但名称或结构无效返回 \`ok: false\`。CLI 应打印警告。

- [ ] **Step 3: 验证 check-modules**

Run: \`node --test --import tsx/esm "packages/cli/scripts/module-install/test/**/*.test.ts"\`  
Expected: 新旧模块契约测试全部通过。

### Task 4: 完善 create-module 脚手架

**Files:**

- Create: \`packages/create-module/templates/base/configs-default/{{configKey}}.json\`
- Modify: \`packages/create-module/templates/base/package.json\`
- Modify: \`packages/create-module/src/create-module.test.ts\`

- [ ] **Step 1: 先扩展生成测试**

断言生成 \`configs-default/hello_mod.json\`，内容为 JSON 对象，且生成后的 package.json files 包含 \`configs-default\`。

- [ ] **Step 2: 新增内容为 \`{}\` 的默认配置模板**

复用现有 \`copyRenderedTree\` 对文件名的模板渲染，不添加专用重命名逻辑。

- [ ] **Step 3: 将 \`configs-default\` 加入模板 package.json files**

- [ ] **Step 4: 验证 create-module**

Run: \`node packages/tools/tsc7.mjs --noEmit -p packages/create-module/tsconfig.json\`  
Run: \`node --test --import tsx/esm packages/create-module/src/create-module.test.ts\`  
Expected: 两条命令均退出 0。

### Task 5: 统一 ESLint 默认配置解析

**Files:**

- Modify: \`modules/sdk/@sfmc-eslint-plugin/src/utils/config-fields.ts\`
- Create: \`modules/sdk/@sfmc-eslint-plugin/src/utils/config-fields.test.ts\`
- Modify: \`modules/sdk/@sfmc-eslint-plugin/src/rules/valid-config-key.test.ts\`

- [ ] **Step 1: 先写标准路径测试**

在临时模块创建 manifest 和 \`configs-default/<configKey>.json\`，断言读取业务顶层字段并过滤 \`$schema\` 与下划线内部键。

- [ ] **Step 2: 将标准路径放到候选列表首位**

首选 \`<packageRoot>/configs-default/<configKey>.json\`；保留三个旧格式候选、工作目录配置和平台 schema 回退。

- [ ] **Step 3: 扩展 valid-config-key 测试**

标准默认配置中存在的键通过，未定义键继续产生原有 warning。

- [ ] **Step 4: 验证 ESLint 插件**

Run: \`node packages/tools/tsc7.mjs --noEmit -p modules/sdk/@sfmc-eslint-plugin/tsconfig.json\`  
Run: \`pnpm --filter @sfmc-bds/eslint-plugin test\`  
Expected: 类型检查与测试退出 0。

### Task 6: 更新文档与发布记录

**Files:**

- Modify: \`docs/zh/guide/config.md\`
- Modify: \`docs/en/guide/config.md\`
- Modify: \`docs/zh/dev/conventions.md\`
- Modify: \`docs/zh/dev/cheatsheet.mdx\`
- Modify: \`docs/en/dev/cheatsheet.mdx\`
- Modify: \`packages/create-module/templates/base/README.md\`
- Create: \`.changeset/<generated-name>.md\`

- [ ] **Step 1: 修正用户配置生命周期文档**

说明模块包默认值与工作目录持久配置的区别，以及安装/更新只补缺、不覆盖的规则。

- [ ] **Step 2: 修正作者指南**

要求作者在默认配置中列出全部可配置字段；禁止仅为播种而申请 config:write 权限或在启动时调用 config.set。

- [ ] **Step 3: 添加 patch changeset**

changeset 覆盖 \`@sfmc-bds/cli\`、\`@sfmc-bds/create-module\`、\`@sfmc-bds/eslint-plugin\`。

- [ ] **Step 4: 搜索冲突旧文案**

Run: \`rg -n "Defaults are supplied by the module on first write|默认值.*首次写入|config\\.set.*默认" docs packages/create-module/templates\`  
Expected: 不再存在与新生命周期冲突的文案。

### Task 7: 全量验证与端到端验收

**Files:**

- Verify only: Tasks 1–6 的全部变更

- [ ] **Step 1: 格式与差异检查**

Run: \`git diff --check\`  
Expected: 无空白错误。

- [ ] **Step 2: 运行受影响包的完整验证**

Run:

\`\`\`powershell
pnpm --filter @sfmc-bds/cli typecheck
pnpm --filter @sfmc-bds/cli test
pnpm --filter @sfmc-bds/create-module typecheck
pnpm --filter @sfmc-bds/create-module test
pnpm --filter @sfmc-bds/eslint-plugin typecheck
pnpm --filter @sfmc-bds/eslint-plugin test
\`\`\`

Expected: 六条命令全部退出 0。

- [ ] **Step 3: 在临时 SFMC 工作目录做端到端验收**

依次验证首次 install 创建配置；人工修改标量和数组；默认配置新增嵌套字段；再次 install/update 只补新字段；link 结果一致且源模块仓无修改。

- [ ] **Step 4: 复核工作区范围**

Run: \`git status --short\`  
Expected: 仅有本计划实施文件和实施前已存在的用户改动，无构建产物或临时文件。

- [ ] **Step 5: 提交（仅在用户授权时）**

\`\`\`bash
git add <only-the-implementation-files>
git commit -m "feat(cli): seed module configuration defaults"
\`\`\`
