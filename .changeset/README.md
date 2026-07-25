# Changesets

本仓用 [changesets](https://github.com/changesets/changesets) 管理 `@sfmc-bds/*` 的独立 semver。

## 当前阶段：beta-only

仓库处于 `pre` 模式（见 `pre.json`）。所有发布走 npm dist-tag **`beta`**，版本形如 `0.2.0-beta.0`。

未达 release 门槛前 **禁止** `changeset pre exit` / 发到 `latest`。

## 日常

```bash
# 改完可发包代码后
npx changeset
# 选受影响的包 + patch|minor|major，写中文摘要

# 发版（维护者）
npm run version-packages   # 消费 .changeset/*.md，bump package.json + CHANGELOG
npm run release-packages   # 包装 changeset publish；pre mode → --tag beta
```

详情见 [docs/dev/npm-publish.md](../docs/dev/npm-publish.md)。
