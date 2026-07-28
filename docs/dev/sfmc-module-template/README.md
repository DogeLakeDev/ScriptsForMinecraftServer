# sfmc-module-example

> 模板仓：`Use this template` 派生你的模块仓；改 `example` → 你的 id，跑通三条主路径即可。

## 一次性设置

```bash
node scripts/rename.mjs my-feature --name "我的功能"
npm install
npm run typecheck
```

## 日常开发（主仓里已装好 sfmc + BDS）

```bash
# 安装并链接到主仓 modules/packages/<id>（开发链，改源码即生效）
sfmc mod install --from local --link
sfmc mod enable <id>
sfmc mod reload              # 一次性 rebuild + deploy + reload
sfmc mod watch               # 迭代期：改源码即 rebuild + reload
```

## 测试

```bash
sfmc mod test                # 委托到本仓 `npm test`（node --test + @sfmc-bds/sdk/testing）
# 或：
npm test
```

## 发布（无需懂 npm）

```bash
sfmc mod publish --dry-run   # 预检
sfmc mod publish --bump patch
sfmc mod publish             # 自动登录引导 + bump + npm publish + 薄 index PR
```

> 本机未登录 npm？CLI 给 `npm login --auth-type=web` 提示，浏览器一键授权。
> 首次在该 scope 发包？CLI 翻译 npm 报错并给 confirm 链接。
> 缺 2FA？CLI 提示输入 OTP。

> **「无需懂 npm，跟着 CLI 走即可发布」**

## 目录结构

```text
.
├── package.json              # @sfmc-bds/module-<id>
├── scripts/
│   └── rename.mjs
├── sapi/
│   ├── manifest.json         # feature-<id>
│   ├── tsconfig.json
│   └── src/
│       └── index.ts          # ModuleRegistry.register
├── test/
│   └── <id>.test.ts          # lifecycle smoke
└── .github/workflows/ci.yml
```

## 制品格式

- `npm pack` → `.tgz` = `sfmc mod install <id>` 用的制品
- `npm publish` → 推到 `@<npm-username>/sfmc-module-<id>`（作者自己的 scope）
- 离线分享可用 `local:./x.tgz` 或 `local:./x.zip`（zip 仅 install 接受）

## 修改 `manifest.json` 后

`manifest.json`（permissions / services / configKey / requires）SAPI 启动期缓存——**`sfmc mod watch` 不会热更**。请重启 BDS 进程。

## 资源包（可选）

`resource_pack/` 子目录会被 `sfmc mod build` 自动收集；放在包根即可。
