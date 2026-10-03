# {{pkgName}}

SAPI 模块 `{{id}}`。

## 配置

在 `configs-default/{{configKey}}.json` 中列出所有可配置字段及默认值。SFMC 安装或更新模块时会创建工作目录配置或只补充缺失字段，不覆盖服主已有值。不要为播种默认值而在启动时调用 `config.set()`。

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm run lint
```

## 联调

1. 扩展 **SFMC: Link to SFMC Root**（或 `sfmc mod install {{id}} --from dir:. --link`）
2. **SFMC: Start Watch** / `sfmc mod reload`

## 发布与收录

先填写 `package.json` 中真实的功能介绍、HTTPS 源码仓地址和 SDK peerDependencies；
展示名称默认读取清单的 `name`，可在 `sfmc.registry.json` 中补充名称、介绍、分类、标签和公开作者署名。

```bash
pnpm publish --access public
sfmc mod submit --dry-run
sfmc mod submit
```

提交需要 `gh auth login` 或 `GH_TOKEN`；只提交 `modules/<id>.json`，合并后由索引仓生成 `index.json`。首次收录后，新版本只需发布 npm，索引仓每小时自动同步 `latest`，无需重复提交版本 PR。

## 脚本列表

| 命令             | 作用              |
| ---------------- | ----------------- |
| `pnpm run build` | tsc --noEmit      |
| `pnpm run lint`  | ESLint / Prettier |
