# @sfmc-bds/cli

SFMC 管理 CLI：REPL、服务启停、模块安装、行为包 build/deploy。

## 安装

```bash
<<<<<<< HEAD
pnpm add -g @sfmc-bds/cli@0.2.2
pnpm dlx @sfmc-bds/cli@0.2.2 status
=======
pnpm add -g @sfmc-bds/cli
pnpm dlx @sfmc-bds/cli status
>>>>>>> chore/pnpm-stable-release-prep
```

服主推荐：

```bash
<<<<<<< HEAD
pnpm add -g @sfmc-bds/sfmc@0.2.2
```

仅 CLI（不含后端服务）可安装 `@sfmc-bds/cli`，完整平台请装聚合包。pnpm v11 起对新发布版本默认有 24 小时等待期；发布当天安装请指定精确版本。
=======
pnpm add -g @sfmc-bds/sfmc
```

仅 CLI（不含后端服务）可用 `pnpm add -g @sfmc-bds/cli`，完整平台请装聚合包。
>>>>>>> chore/pnpm-stable-release-prep

## 依赖

- `@sfmc-bds/sdk` 0.2.0
- Node.js >= 22.13

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/packages/cli>
