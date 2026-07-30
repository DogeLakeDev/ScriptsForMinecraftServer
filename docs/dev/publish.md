# 发布你的模块

把作者仓发到 npm，并登记到 [`sfmc-modules`](https://github.com/Tanya7z/sfmc-modules) 薄 index，供 `mod search` / `mod install` 发现。

业务模块 **不走** 主仓 changesets。平台 `@sfmc-bds/*` 发包见文末。  
`sfmc mod publish` 已移除；请直接使用 npm（及可选 `gh` 开 index PR）。

## 发布前

| 检查 | 说明 |
| ------ | ------ |
| `private` | 勿为 `true` |
| `name` | `@<user>/sfmc-module-<id>` 或官方 `@sfmc-bds/module-<id>` |
| `files` | 含 `sapi` |
| 测试 / lint | `npm test`；接上 [ESLint](./eslint.md) 更稳 |
| 登录 | `npm login`；官方 scope 另需组织权限 |

```bash
npm publish --access public
# 或按包上的 dist-tag：
npm publish --tag beta
```

向薄 index 开 PR：在 `sfmc-modules` 仓库的 `index.json` 增加条目（`id` / `npm` / 版本说明）。可用 GitHub CLI 自行开 PR。

!!! tip "提示"
    当前生态以 **beta** 为主时，安装侧请写 `@beta` 或按你包上的 dist-tag 说明。

## 发布后

1. 确认 index 出现该模块的 `npm` 字段  
2. 在 SFMC 工作目录：`sfmc mod install <id>`  
3. `mod enable` → `mod reload`

命名与联调见 [模块开发](./module-author.md)。

---

## 附录：平台包发布（贡献者）

主仓 `@sfmc-bds/*` 走 changesets：`npx changeset` → Version PR → `ci-release-packages`。详见 [贡献指南](./contributing.md)。
