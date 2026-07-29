#!/usr/bin/env node
// @ts-check
/**
 * tools/new-module.mjs — 生成最小模块骨架（单包根）
 *
 * - 写入 **当前工作目录**（须为空）—— 与 Tanya7z/sfmc-module-template 同构
 * - `--root` / SFMC_MODULES_ROOT 已移除（sfmc-modules 仅为 index）
 * - `--official` → `@sfmc-bds/module-<id>`；默认 `@CHANGE_ME/sfmc-module-<id>`
 *
 * Usage:
 *   mkdir my-mod && cd my-mod
 *   node tools/new-module.mjs my-mod --name "我的模块"
 *   node tools/new-module.mjs --list-templates
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg, code = 1) {
  console.error(`[new-module] ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  /** @type {{ name: string | null, root: string | null, template: string, listTemplates: boolean, official: boolean }} */
  const flags = { name: null, root: null, template: "minimal", listTemplates: false, official: false };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") flags.name = argv[++i] ?? null;
    else if (a === "--root") flags.root = argv[++i] ?? null;
    else if (a === "--template") flags.template = argv[++i] ?? "minimal";
    else if (a === "--list-templates") flags.listTemplates = true;
    else if (a === "--official") flags.official = true;
    else if (a.startsWith("--name=")) flags.name = a.slice("--name=".length);
    else if (a.startsWith("--root=")) flags.root = a.slice("--root=".length);
    else if (a.startsWith("--template=")) flags.template = a.slice("--template=".length);
    else if (a.startsWith("--")) die(`未知参数: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

/**
 * 模板清单 —— 这是 sfmc-modules 可用模板的唯一权威源(OCP)。
 * 加新模板只需:
 *   1) 在下方数组里加一条(配合 buildManifest 分支处理)
 *   2) 在 sfmc CLI 的 i18n 中加 modwiz.tpl.<id> / modwiz.tpl.<id>Hint
 *
 * 注意:不在此处放显示文案;本地化由 sfmc i18n 接管,本工具只暴露机器可读清单。
 *
 * 输出格式:每行 `<id>` 或 `<id>\tdefault` —— 单源、纯文本、无 JSON 依赖。
 */
const TEMPLATES = [
  { id: "minimal", isDefault: true },
  { id: "db", isDefault: false },
];

function emitTemplateList() {
  for (const tpl of TEMPLATES) {
    process.stdout.write(`${tpl.id}${tpl.isDefault ? "\tdefault" : ""}\n`);
  }
}

function isValidFolderId(id) {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}

/**
 * 决定模块骨架落盘位置：
 *   缺省 → 写到 cwd（单包根，与 Tanya7z/sfmc-module-template 同构）
 * --root / SFMC_MODULES_ROOT 已移除（sfmc-modules 仅为 index）。
 */
function resolveTargetDir(flags) {
  if (flags.root || process.env.SFMC_MODULES_ROOT) {
    die(
      `--root / SFMC_MODULES_ROOT 已移除：sfmc-modules 仅为 index。请在空目录运行本工具生成单包根，或使用 Tanya7z/sfmc-module-template。`
    );
  }
  return path.resolve(process.cwd());
}

/**
 * @param {string} folderId
 * @param {{ cwdMode: boolean }} opts  cwdMode=true → 自包含（指向 node_modules）；legacy → 相对主仓路径
 */
function buildPackageJson(folderId, opts) {
  const base = {
    name: opts.official ? `@sfmc-bds/module-${folderId}` : `@CHANGE_ME/sfmc-module-${folderId}`,
    version: "0.1.0",
    type: "module",
    description: `SAPI module: ${folderId}`,
    main: "sapi/src/index.ts",
    files: ["sapi", "test"],
  };
  /* 自包含单包根（与 Tanya7z/sfmc-module-template 同构） */
  return {
    ...base,
    scripts: {
      typecheck: "tsc --noEmit -p sapi/tsconfig.json",
      test: "node --test --import tsx/esm test/*.test.ts",
    },
    devDependencies: {
      "@sfmc-bds/sdk": "^0.2.0-beta.5",
      "@minecraft/server": "2.10.0-beta.1.26.40-preview.30",
      "@types/node": "^22.13.0",
      tsx: "^4.19.0",
      typescript: "^5.6.0",
    },
    peerDependencies: { "@sfmc-bds/sdk": ">=0.2.0" },
    engines: { node: ">=22.13.0" },
  };
}

/** 写出配置用的相对路径（posix，且始终带 ./ 或 ../） */
function relPosix(fromDir, toFile) {
  let rel = path.relative(fromDir, toFile).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

/**
 * @param {string} folderId
 * @param {string} displayName
 * @param {"minimal"|"db"} template
 * @param {string} schemaRel $schema 相对 sapi/ 的路径（由调用方按落盘位置计算）
 */
function buildManifest(folderId, displayName, template, schemaRel) {
  if (folderId.startsWith("feature-") || folderId.startsWith("core-")) {
    die(`folder 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
  const logicalId = `feature-${folderId}`;
  const configKey = folderId.replace(/-/g, "_");
  /** @type {Record<string, unknown>} */
  const base = {
    $schema: schemaRel,
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

/** @param {string} extendsRel 相对 sapi/ 的 tsconfig extends */
function buildTsConfig(extendsRel) {
  return {
    extends: extendsRel,
    compilerOptions: {
      noEmit: true,
      rootDir: "./src",
    },
    include: ["src/**/*"],
  };
}

/**
 * 自包含 sapi/tsconfig.json（cwdMode=true） —— 不依赖主仓 tsconfig.base.json；
 * SDK 类型由 npm 装入 node_modules/@sfmc-bds/sdk 时随附。
 */
function buildTsConfigStandalone() {
  return {
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      target: "es2022",
      lib: ["es2022"],
      types: ["node"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
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

  /* 模板清单查询:走 stdout 后立刻退出 —— 主流程不要走到此分支 */
  if (flags.listTemplates) {
    emitTemplateList();
    return;
  }

  const folderId = positional[0];
  if (!folderId) {
    die(
      "用法: new-module.mjs <id> [--name <名>] [--template minimal|db] [--official]\n" +
        "  在空目录（单包根）运行；与 Tanya7z/sfmc-module-template 同构。"
    );
  }
  if (!isValidFolderId(folderId)) {
    die(`id 须为小写 kebab-case，例如 my-mod（收到: ${folderId}）`);
  }
  if (folderId.startsWith("feature-") || folderId.startsWith("core-")) {
    die(`id 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
  const target = resolveTargetDir(flags);
  if (fs.existsSync(path.join(target, "sapi")) || fs.existsSync(path.join(target, "package.json"))) {
    die(`目标已含模块骨架: ${target}（请用空目录）`);
  }

  const displayName = flags.name?.trim() || folderId;
  const template = flags.template === "db" ? "db" : "minimal";
  const official = Boolean(flags.official);

  const sapiDir = path.join(target, "sapi");
  const schemaRel = "../../node_modules/@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json";
  const tsConfigJson = buildTsConfigStandalone();

  writeJson(path.join(target, "package.json"), buildPackageJson(folderId, { official }));
  writeJson(path.join(sapiDir, "manifest.json"), buildManifest(folderId, displayName, template, schemaRel));
  writeJson(path.join(sapiDir, "tsconfig.json"), tsConfigJson);
  writeText(path.join(sapiDir, "src", "index.ts"), buildIndexTs(folderId, displayName));

  const npmName = official ? `@sfmc-bds/module-${folderId}` : `@CHANGE_ME/sfmc-module-${folderId}`;
  console.log(`[new-module] 已创建 ${target}`);
  console.log(`[new-module]   模式: cwd 单包根`);
  console.log(`[new-module]   npm: ${npmName}`);
  console.log(`[new-module]   manifest id: feature-${folderId}`);
  console.log(`[new-module]   下一步:`);
  console.log(`[new-module]     npm install && npm run typecheck`);
  console.log(
    `[new-module]     （主仓）sfmc mod install ${folderId} --from dir:${target} --link`
  );
}

main();
