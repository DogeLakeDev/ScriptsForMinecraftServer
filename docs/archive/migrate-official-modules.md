# 官方模块从归档迁到独立仓

`sfmc-modules` 主分支已是纯 index。旧 monorepo 源码在：

- 本地旁路仓分支：`archive/monorepo-packages`
- 标签：`archive/packages-2026-07-29`

## 单模块迁仓步骤

```bash
# 1) 取出归档源码（在 sfmc-modules 仓）
cd ../sfmc-modules
git checkout archive/monorepo-packages -- packages/economy
# 或从 tag: git archive archive/packages-2026-07-29 packages/economy | tar -x

# 2) 新建独立仓（基于 template）
# GitHub: Use Tanya7z/sfmc-module-template → sfmc-module-economy
# 把 packages/economy 内容拷入新仓根（覆盖 sapi/ 等）

# 3) 对齐 package.json
# name: @sfmc-bds/module-economy
# 去掉 private；files 含 sapi；对齐 SDK peer

# 4) 发布（旧 `sfmc mod publish` 已移除）
npm publish --access public
# 再向 sfmc-modules 薄 index 开 PR；或走模板 CI Trusted Publishing

# 5) 确认 index.json 出现 npm 字段后，可删该条目的 repo/tag
```

建议顺序：`economy` → `area` / `gui` → 其余。

## 平台侧验证

```bash
cd ../ScriptsForMinecraftServer
sfmc mod install economy   # 应走 npm:（index 有 npm 后）
# 过渡期仍可为 github:（仅 repo+tag）
```

本轮**不要求**一次迁完所有模块；开发已不再依赖 monorepo。
