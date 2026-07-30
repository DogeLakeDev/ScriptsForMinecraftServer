# Changesets

本仓用 [changesets](https://github.com/changesets/changesets) 管理 `@sfmc-bds/*` 的独立 semver。

## 当前阶段：beta-only（pre mode）

见 `pre.json`：`mode: pre`, `tag: beta`。版本形如 `0.2.0-beta.0`，npm dist-tag 为 **`beta`**。

未达 release 门槛前 **禁止** `changeset pre exit` / 发到 `latest`。

## 日常开发

```bash
# 改完可发包代码后
npm run changeset
# 选受影响的包 + patch|minor|major，写中文摘要
```

## 本地发版（维护者）

当前在 pre mode，请用 **prerelease**：

```bash
npm run prerelease-packages
```

入口为 `node tools/run-release.mjs --pre`，内部依次：assert pre → ensure changeset → version → commit → tag → push → publish → GitHub Pre-release。

退出 pre 且达标后，正式发版：

```bash
npx changeset pre exit
npm run release-packages   # run-release.mjs --stable → npm latest + GitHub Release
```

## CI

`changeset-release.yml` 在 `main` 上开 Version PR；合并后跑 `ci-release-packages`（`run-release.mjs --ci`：publish → tag → push tags → gh release，无交互）。

详情见 [docs/dev/publish.md](../docs/dev/publish.md)（平台包附录）。
