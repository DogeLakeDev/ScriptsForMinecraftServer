#!/usr/bin/env node
/**
 * tools/new-module.mjs — 生成最小模块骨架
 *
 * 新语义（plan: scaffold-redirect）：
 *   - 默认：写入 **当前工作目录**（cwd）作为单包根 —— 与 Tanya7z/sfmc-module-template 同构
 *   - --root <path> 显式覆盖：写到 `<root>/packages/<id>`（兼容旧 sfmc-modules 工作区）
 *   - 拒绝写主仓本体的 modules/packages/<>（那是 install 落点，不是开发工作区）
 *
 * Usage:
 *   node tools/new-module.mjs <id> [--name <显示名>] [--template minimal|db]   # cwd
 *   node tools/new-module.mjs <id> --root D:/sfmc-modules                     # 旧工作区
 *   node tools/new-module.mjs --list-templates
 *
 * 由 `sfmc module create` 交互向导调用；也可单独使用。
 *
 * —— 模板清单是模板名空间的唯一权威源 ——
 * `sfmc module create` 向导应在启动时 spawn `new-module.mjs --list-templates` 取一份
 * 可用模板清单，向导代码不应自己硬编码一份同名表(LSP/DRY)。新加模板只该改一处。
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
  /** @type {{ name: string | null, root: string | null, template: string, listTemplates: boolean }} */
  const flags = { name: null, root: null, template: "minimal", listTemplates: false };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") flags.name = argv[++i] ?? null;
    else if (a === "--root") flags.root = argv[++i] ?? null;
    else if (a === "--template") flags.template = argv[++i] ?? "minimal";
    else if (a === "--list-templates") flags.listTemplates = true;
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
 *   1. --root 显式覆盖 → 写到 <root>/packages/<id>（旧工作区兼容）
 *   2. 缺省 → 写到 cwd（单包根，与 Tanya7z/sfmc-module-template 同构）
 * 拒绝写主仓本体的 modules/packages/（避免把开发工作区混进 install 落点）。
 */
function resolveModulesRoot(flags) {
  if (flags.root) {
    const resolved = path.resolve(flags.root);
    if (!fs.existsSync(path.join(resolved, "packages"))) {
      die(`--root 目录缺少 packages/: ${resolved}`);
    }
    /* 拒绝覆盖主仓 modules/packages：那是 install 落点，不是开发工作区 */
    const platformPkgs = path.join(ROOT, "modules", "packages");
    if (path.resolve(resolved) === path.resolve(platformPkgs)) {
      die(`禁止写主仓 modules/packages（install 落点）；请用 cwd 单包根或 --root 指向独立 sfmc-modules。`);
    }
    return resolved;
  }
  if (process.env.SFMC_MODULES_ROOT) {
    return path.resolve(process.env.SFMC_MODULES_ROOT);
  }
  /* 缺省：cwd */
  return process.cwd();
}

/**
 * @param {string} folderId
 * @param {{ cwdMode: boolean }} opts  cwdMode=true → 自包含（指向 node_modules）；legacy → 相对主仓路径
 */
function buildPackageJson(folderId, opts) {
  const base = {
    name: `@sfmc-bds/module-${folderId}`,
    version: "0.1.0",
    private: true,
    type: "module",
    description: `SAPI module: ${folderId}`,
    main: "sapi/src/index.ts",
    files: ["sapi", "test"],
  };
  if (opts.cwdMode) {
    /* 自包含（与 Tanya7z/sfmc-module-template 同构）：SDK 由 npm 装在 node_modules */
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
  /* legacy 工作区模式：依赖走主仓同仓 workspace 解析 */
  return {
    ...base,
    scripts: { typecheck: "tsc7 --noEmit -p sapi/tsconfig.json" },
    dependencies: { "@sfmc-bds/sdk": "^0.1.0" },
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
    die("用法: new-module.mjs <id> [--name <名>] [--root <sfmc-modules>] [--template minimal|db]\n" +
        "  缺省 --root：写到当前工作目录（单包根，与 Tanya7z/sfmc-module-template 同构）。");
  }
  if (!isValidFolderId(folderId)) {
    die(`id 须为小写 kebab-case，例如 my-mod（收到: ${folderId}）`);
  }
  if (folderId.startsWith("feature-") || folderId.startsWith("core-")) {
    die(`id 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
  const useLegacyWorktree = Boolean(flags.root || process.env.SFMC_MODULES_ROOT);
  const target = useLegacyWorktree
    ? path.join(resolveModulesRoot(flags), "packages", folderId)
    : path.resolve(process.cwd());
  if (fs.existsSync(path.join(target, "sapi")) || fs.existsSync(path.join(target, "package.json"))) {
    die(`目标已含模块骨架: ${target}（cwd 非空，请用空目录或 --root 显式指向旧工作区）`);
  }

  const displayName = flags.name?.trim() || folderId;
  const template = flags.template === "db" ? "db" : "minimal";

  const sapiDir = path.join(target, "sapi");
  const cwdMode = !useLegacyWorktree;

  /* schema 与 tsconfig.base 仅在 legacy 工作区模式需要（cwdMode 自包含）。 */
  let schemaRel = "../../node_modules/@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json";
  let tsConfigJson;
  if (!cwdMode) {
    const schemaAbs = path.join(ROOT, "modules", "sdk", "@sfmc-sdk", "schemas", "sapi-manifest.v2.schema.json");
    const baseTsAbs = path.join(ROOT, "modules", "tsconfig.base.json");
    if (!fs.existsSync(schemaAbs)) die(`找不到 manifest schema: ${schemaAbs}`);
    if (!fs.existsSync(baseTsAbs)) die(`找不到 tsconfig.base.json: ${baseTsAbs}`);
    schemaRel = relPosix(sapiDir, schemaAbs);
    tsConfigJson = buildTsConfig(relPosix(sapiDir, baseTsAbs));
  } else {
    tsConfigJson = buildTsConfigStandalone();
  }

  writeJson(path.join(target, "package.json"), buildPackageJson(folderId, { cwdMode }));
  writeJson(
    path.join(sapiDir, "manifest.json"),
    buildManifest(folderId, displayName, template, schemaRel)
  );
  writeJson(path.join(sapiDir, "tsconfig.json"), tsConfigJson);
  writeText(path.join(sapiDir, "src", "index.ts"), buildIndexTs(folderId, displayName));

  console.log(`[new-module] 已创建 ${target}`);
  console.log(`[new-module]   模式: ${cwdMode ? "cwd 单包根" : "legacy 工作区"}`);
  console.log(`[new-module]   npm: @sfmc-bds/module-${folderId}`);
  console.log(`[new-module]   manifest id: feature-${folderId}`);
  if (cwdMode) {
    console.log(`[new-module]   下一步:`);
    console.log(`[new-module]     npm install`);
    console.log(`[new-module]     sfmc mod install --from local --link  # 主仓里跑`);
  } else {
    console.log(`[new-module]   下一步: sfmc module link ${folderId}`);
  }
}

main();
