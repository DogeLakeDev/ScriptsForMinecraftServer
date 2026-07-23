#!/usr/bin/env node
/**
 * tools/new-module.mjs — 在 sfmc-modules/packages/<id>/ 下生成最小模块骨架
 *
 * Usage:
 *   node tools/new-module.mjs <id> [--name <显示名>] [--root <sfmc-modules>] [--template minimal|db]
 *
 * 由 `sfmc module create` 交互向导调用；也可单独使用。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ROOT } from "./lib/paths.mjs";

function die(msg, code = 1) {
  console.error(`[new-module] ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  /** @type {{ name: string | null, root: string | null, template: string }} */
  const flags = { name: null, root: null, template: "minimal" };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") flags.name = argv[++i] ?? null;
    else if (a === "--root") flags.root = argv[++i] ?? null;
    else if (a === "--template") flags.template = argv[++i] ?? "minimal";
    else if (a.startsWith("--name=")) flags.name = a.slice("--name=".length);
    else if (a.startsWith("--root=")) flags.root = a.slice("--root=".length);
    else if (a.startsWith("--template=")) flags.template = a.slice("--template=".length);
    else if (a.startsWith("--")) die(`未知参数: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

function isValidFolderId(id) {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}

function resolveModulesRoot(flags) {
  if (flags.root) {
    const resolved = path.resolve(flags.root);
    if (!fs.existsSync(path.join(resolved, "packages"))) {
      die(`目录缺少 packages/: ${resolved}`);
    }
    return resolved;
  }
  if (process.env.SFMC_MODULES_ROOT) {
    return path.resolve(process.env.SFMC_MODULES_ROOT);
  }
  const sibling = path.resolve(ROOT, "..", "sfmc-modules");
  if (fs.existsSync(path.join(sibling, "packages"))) return sibling;
  die("请用 --root 或 SFMC_MODULES_ROOT 指定 sfmc-modules 根目录");
}

function buildPackageJson(folderId) {
  return {
    name: `@sfmc-bds/module-${folderId}`,
    version: "0.1.0",
    private: true,
    type: "module",
    description: `SAPI module: ${folderId}`,
    main: "sapi/src/index.ts",
    scripts: {
      typecheck: "tsc --noEmit -p sapi/tsconfig.json",
    },
    dependencies: {
      "@sfmc-bds/sdk": "^0.1.0",
    },
  };
}

function buildManifest(folderId, displayName, template) {
  if (folderId.startsWith("feature-") || folderId.startsWith("core-")) {
    die(`folder 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
  const logicalId = `feature-${folderId}`;
  const configKey = folderId.replace(/-/g, "_");
  /** @type {Record<string, unknown>} */
  const base = {
    $schema: "../../../node_modules/@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json",
    schemaVersion: 2,
    id: logicalId,
    name: displayName,
    type: "feature",
    configKey,
    requires: [],
    permissions: [`config:read:${configKey}`],
    services: { provides: [], requires: [] },
    notes: `由 sfmc module create 脚手架生成（template=${template}）`,
  };
  if (template === "db") {
    base.permissions = [`db:read:sfmc_${configKey}`, `db:write:sfmc_${configKey}`, `config:read:${configKey}`];
    base.notes =
      `由 sfmc module create 脚手架生成（含 db 权限占位）。` +
      `请在 sapi/manifest.json 中补全 routes/migrations，并实现 db 表。`;
  }
  return base;
}

function buildTsConfig() {
  return {
    extends: "../../../tsconfig.base.json",
    compilerOptions: {
      noEmit: true,
      rootDir: "./src",
    },
    include: ["src/**/*"],
  };
}

function buildIndexTs(folderId, displayName) {
  const logicalId = `feature-${folderId}`;
  const perm = folderId.replace(/-/g, "_");
  return `/**
 * @sfmc-bds/module-${folderId} — ${displayName}
 * 由 sfmc module create 脚手架生成。
 */

import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Command, Permission, Msg } from "@sfmc-bds/sdk/sapi/runtime";

const MODULE_ID = "${logicalId}";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("${perm}.use", Permission.Any);
    },
    registerCommands() {
      Command.register(
        "${perm}",
        "${perm}.use",
        () => {
          Msg.info("模块 ${displayName} 已就绪");
        },
        "${displayName}"
      );
    },
    async init() {
      /* TODO: 读取 configs/${perm}.json、注册 db 表等 */
    },
    cleanup() {},
  },
});
`;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const folderId = positional[0];
  if (!folderId) {
    die("用法: new-module.mjs <id> [--name <名>] [--root <sfmc-modules>] [--template minimal|db]");
  }
  if (!isValidFolderId(folderId)) {
    die(`id 须为小写 kebab-case，例如 my-mod（收到: ${folderId}）`);
  }
  if (folderId.startsWith("feature-") || folderId.startsWith("core-")) {
    die(`id 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
  const modulesRoot = resolveModulesRoot(flags);
  const target = path.join(modulesRoot, "packages", folderId);
  if (fs.existsSync(target)) {
    die(`目标已存在: ${target}`);
  }

  const displayName = flags.name?.trim() || folderId;
  const template = flags.template === "db" ? "db" : "minimal";

  writeJson(path.join(target, "package.json"), buildPackageJson(folderId));
  writeJson(path.join(target, "sapi", "manifest.json"), buildManifest(folderId, displayName, template));
  writeJson(path.join(target, "sapi", "tsconfig.json"), buildTsConfig());
  writeText(path.join(target, "sapi", "src", "index.ts"), buildIndexTs(folderId, displayName));

  console.log(`[new-module] 已创建 ${target}`);
  console.log(`[new-module]   npm: @sfmc-bds/module-${folderId}`);
  console.log(`[new-module]   manifest id: feature-${folderId}`);
  console.log(`[new-module]   下一步: sfmc module link ${folderId}`);
}

main();
