#!/usr/bin/env node
// @ts-check
/**
 * tools/new-module.mjs — 生成最小模块骨架（单包根）
 *
 * - 写入 **当前工作目录**（须为空）—— 与 Tanya7z/sfmc-module-template 同构
 * - 传入 `--root` / `SFMC_MODULES_ROOT` 会直接退出（sfmc-modules 仅为 index）
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
 * 决定模块骨架落盘位置：写到 cwd（单包根，与 Tanya7z/sfmc-module-template 同构）。
 * 传入 `--root` / `SFMC_MODULES_ROOT` 会退出。
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
 * @param {{ official: boolean }} opts
 */
function buildPackageJson(folderId, opts) {
  const base = {
    name: opts.official ? `@sfmc-bds/module-${folderId}` : `@CHANGE_ME/sfmc-module-${folderId}`,
    version: "0.1.0",
    type: "module",
    description: `SAPI module: ${folderId}`,
    main: "sapi/src/index.ts",
    exports: {
      ".": "./sapi/src/index.ts",
    },
    files: ["sapi", "test", "README.md", "LICENSE"],
  };
  /* 自包含单包根（与 Tanya7z/sfmc-module-template 同构） */
  return {
    ...base,
    scripts: {
      build: "npm run typecheck",
      typecheck: "tsc --noEmit -p sapi/tsconfig.json",
      test: "node --test --import @sfmc-bds/sdk/testing/minecraft-loader --import tsx/esm test/*.test.ts",
      lint: 'eslint "sapi/**/*.ts" "test/**/*.ts"',
      format: "prettier --write .",
    },
    devDependencies: {
      "@minecraft/server": "2.10.0-beta.1.26.40-preview.30",
      "@minecraft/server-net": "1.0.0-beta.11940b24",
      "@minecraft/server-ui": "2.2.0-beta.1.26.40-preview.30",
      "@minecraft/vanilla-data": "1.26.40-preview.30",
      "@sfmc-bds/eslint-plugin": "^0.1.0",
      "@sfmc-bds/sdk": "^0.2.0-beta.7",
      "@types/node": "^22.13.0",
      "@typescript-eslint/eslint-plugin": "^8.64.0",
      "@typescript-eslint/parser": "^8.64.0",
      eslint: "^10.7.0",
      prettier: "^3.9.5",
      "prettier-plugin-organize-imports": "^4.3.0",
      tsx: "^4.19.0",
      typescript: "^5.6.0",
    },
    peerDependencies: { "@sfmc-bds/sdk": ">=0.2.0" },
    engines: { node: ">=22.13.0" },
  };
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
    notes: `由 tools/new-module.mjs 脚手架生成（template=${template}）`,
  };
  if (template === "db") {
    base.permissions = [`db:read:sfmc_${configKey}`, `db:write:sfmc_${configKey}`, `config:read:${configKey}`];
    base.notes =
      `由 tools/new-module.mjs 脚手架生成（含 db 权限占位）。` +
      `请在 sapi/manifest.json 中补全 routes/migrations，并实现 db 表。`;
  }
  return base;
}

/**
 * 自包含 sapi/tsconfig.json —— 不依赖平台仓 tsconfig.base.json；
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

function buildRootTsConfig() {
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
    },
    include: ["sapi/**/*", "test/**/*"],
  };
}

/**
 * @param {string} folderId
 * @param {string} displayName
 * @param {string} pkgName
 */
function buildIndexTs(folderId, displayName, pkgName) {
  const logicalId = `feature-${folderId}`;
  const perm = folderId.replace(/-/g, "_");
  return `/**
 * ${pkgName} — ${displayName}
 * 由 tools/new-module.mjs 脚手架生成。
 */

import { ModuleRegistry, type ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import { Command, Msg, Permission } from "@sfmc-bds/sdk/sapi/runtime";

/** 与 sapi/manifest.json 的 id 一致（逻辑 id，非文件夹短名）。 */
export const MODULE_ID = "${logicalId}";

/** 命令权限名。 */
export const PERM = "${perm}.use";

function registerPermissions(): void {
  Permission.register(PERM, Permission.Any);
}

function registerCommands(): void {
  Command.register(
    "${perm}",
    PERM,
    (player) => {
      if (!player) return;
      Msg.info("模块 ${displayName} 已就绪", player);
    },
    "${displayName}",
    MODULE_ID
  );
}

function registerEvents(): void {
  /* 事件订阅放在本阶段，不要放进 init()。 */
}

function init(): void {
  /* TODO: 读取 configs/${perm}.json、注册 db 表等 */
}

function cleanup(): void {
  /* TODO: 取消事件订阅、关闭 handle、清理定时器。 */
}

export const DESCRIPTOR: ModuleDescriptor = {
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions,
    registerCommands,
    registerEvents,
    init,
    cleanup,
  },
};

ModuleRegistry.register(DESCRIPTOR);
`;
}

/**
 * @param {string} folderId
 * @param {string} displayName
 */
function buildExampleTest(folderId, displayName) {
  const logicalId = `feature-${folderId}`;
  const cmdName = folderId.replace(/-/g, "_");
  const readyMsg = `模块 ${displayName} 已就绪`;
  return `/**
 * test/${folderId}.test.ts — 模块 lifecycle + 命令冒烟（假引擎）
 *
 * 跑法：npm test（SDK minecraft-loader + createSandbox）
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertMsg, createSandbox, runCleanup } from "@sfmc-bds/sdk/testing";

import { DESCRIPTOR, MODULE_ID, PERM } from "../sapi/src/index.js";

const MANIFEST_PATH = fileURLToPath(new URL("../sapi/manifest.json", import.meta.url));

function readManifest(): {
  id: string;
  configKey: string;
  permissions?: string[];
} {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    id: string;
    configKey: string;
    permissions?: string[];
  };
}

test("descriptor / MODULE_ID 与 sapi/manifest.json 一致", () => {
  const manifest = readManifest();
  assert.equal(DESCRIPTOR.id, MODULE_ID);
  assert.equal(MODULE_ID, manifest.id, "MODULE_ID 必须等于 manifest.id");
  assert.equal(DESCRIPTOR.id, manifest.id, "DESCRIPTOR.id 必须等于 manifest.id");
  assert.equal(MODULE_ID, "${logicalId}");
  assert.equal(DESCRIPTOR.afterWorldLoad, false);
  assert.equal(typeof DESCRIPTOR.lifecycle.registerPermissions, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.registerCommands, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.registerEvents, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.init, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.cleanup, "function");
});

test("PERM / 命令名与 manifest.configKey 对齐", () => {
  const manifest = readManifest();
  assert.ok(manifest.configKey, "manifest.configKey 必填");
  assert.equal(PERM, \`\${manifest.configKey}.use\`);
  assert.ok(
    Array.isArray(manifest.permissions) &&
      manifest.permissions.includes(\`config:read:\${manifest.configKey}\`),
    \`manifest.permissions 应含 config:read:\${manifest.configKey}\`
  );
});

test("createSandbox lifecycle 跑通", async (t) => {
  const sb = await createSandbox({ module: DESCRIPTOR });
  t.after(() => sb.dispose());
  assert.ok(sb.world);
  assert.ok(sb.system);
});

test("命令 ${cmdName} 触发后，玩家收到 Msg.info", async (t) => {
  const sb = await createSandbox({ module: DESCRIPTOR });
  t.after(() => sb.dispose());
  const player = sb.addPlayer({ id: "tester-1", name: "tester", op: true });
  await sb.triggerCommand("${cmdName}", player);
  assert.ok(assertMsg(player, "${readyMsg}", "§"), "玩家 log 应含预期文本");
  assert.equal(player.log.length, 1);
  assert.match(player.log[0]!, /^§f\\[\\*\\] /);
});

test("cleanup 不抛错", async () => {
  const r = await runCleanup(DESCRIPTOR);
  assert.equal(r.ok, true, \`cleanup 抛出: \${r.error instanceof Error ? r.error.message : String(r.error)}\`);
});

test("PERM 格式正确", () => {
  assert.match(PERM, /^[a-z][a-z0-9_]*\\.use$/);
});
`;
}

/** 与 sfmc-module-template/eslint.config.js 同构 */
function buildEslintConfigJs() {
  return `// SFMC 模块 ESLint 配置
import sfmc from "@sfmc-bds/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/build/**", "**/*.d.ts"],
  },
  {
    files: ["sapi/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@sfmc-bds": sfmc,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "error",
      ...sfmc.configs.recommended.rules,
    },
  },
  {
    /* 旧版 eslint-plugin 静态白名单可能未含 testing；测试文件允许 SDK testing 入口 */
    files: ["test/**/*.ts"],
    rules: {
      "@sfmc-bds/no-sdk-private-export": "off",
    },
  },
];
`;
}

function buildGitignore() {
  return `node_modules/
dist/
*.tgz
*.log
.DS_Store
.idea/
`;
}

function buildPrettierRc() {
  return {
    trailingComma: "es5",
    tabWidth: 2,
    semi: true,
    singleQuote: false,
    bracketSpacing: true,
    arrowParens: "always",
    printWidth: 120,
    endOfLine: "crlf",
    plugins: ["prettier-plugin-organize-imports"],
  };
}

function buildPrettierIgnore() {
  return `node_modules/
dist/
*.tgz
package-lock.json
.sfmc/
`;
}

function buildLicense() {
  return `ISC License

Copyright (c) ${new Date().getFullYear()}, ScriptsForMinecraftServer contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`;
}

/**
 * @param {string} folderId
 * @param {string} displayName
 * @param {string} pkgName
 */
function buildReadme(folderId, displayName, pkgName) {
  return `# ${folderId}

${displayName}（\`${pkgName}\`）— SFMC SAPI 模块。

## 最短成功路径

\`\`\`bash
npm install
npm run typecheck
npm test
npm run lint
\`\`\`

用 VS Code / Cursor **单独打开本仓根**。推荐扩展：ESLint、Prettier、SFMC Module、Node.js Test Runner。

1. 侧栏 **脚本沙箱**（不依赖 \`sfmc.root\`）
2. 真机联调：设 \`sfmc.root\` 为 SFMC **工作目录**（含 \`configs/\`、\`modules/\`），再 Start Watch / Reload to BDS
3. link：\`sfmc mod install ${folderId} --from dir:<本仓绝对路径> --link\`

| 命令 | 作用 |
| --- | --- |
| \`npm run build\` / \`typecheck\` | tsc --noEmit |
| \`npm test\` | createSandbox + DESCRIPTOR |
| \`npm run lint\` / \`format\` | ESLint / Prettier |

\`DESCRIPTOR.id\` 须与 \`sapi/manifest.json\` 的 \`id\`（\`feature-${folderId}\`）一致。
`;
}

/**
 * @param {string} folderId
 * @param {string} displayName
 */
function buildSandboxScript(folderId, displayName) {
  const cmdName = folderId.replace(/-/g, "_");
  const readyMsg = `模块 ${displayName} 已就绪`;
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "n1",
        type: "stimulus",
        position: { x: 40, y: 120 },
        data: {
          kind: "player",
          title: "alice",
          detail: "op · overworld",
          props: {
            id: "player-alice",
            name: "alice",
            op: true,
            dimensionId: "minecraft:overworld",
            location: { x: 0, y: 64, z: 0 },
          },
          objectId: "player-alice",
        },
      },
      {
        id: "n2",
        type: "stimulus",
        position: { x: 300, y: 120 },
        data: {
          kind: "emit",
          title: "chatSend",
          detail: "world.beforeEvents.chatSend",
          path: "world.beforeEvents.chatSend",
          props: {
            message: `!${cmdName}`,
            cancel: false,
            sender: { $ref: "player-alice" },
          },
        },
      },
      {
        id: "n3",
        type: "stimulus",
        position: { x: 560, y: 120 },
        data: {
          kind: "assert",
          assertKind: "log",
          title: "日志含文案",
          detail: readyMsg,
          pattern: readyMsg,
        },
      },
    ],
    edges: [
      { id: "e1-2", source: "n1", target: "n2" },
      { id: "e2-3", source: "n2", target: "n3" },
    ],
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeVscodeWorkspace(target) {
  writeJson(path.join(target, ".vscode", "extensions.json"), {
    recommendations: [
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode",
      "sfmc-bds.sfmc-module",
      "connor4312.nodejs-testing",
    ],
  });
  writeJson(path.join(target, ".vscode", "settings.json"), {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "eslint.useFlatConfig": true,
    "eslint.validate": ["javascript", "typescript"],
    "nodejs-testing.include": ["./test"],
    "nodejs-testing.extensions": [
      {
        extensions: ["ts"],
        parameters: ["--import", "@sfmc-bds/sdk/testing/minecraft-loader", "--import", "tsx/esm"],
      },
    ],
  });
  writeJson(path.join(target, ".vscode", "launch.json"), {
    version: "0.2.0",
    configurations: [
      {
        type: "node",
        request: "launch",
        name: "Debug Module Tests",
        runtimeArgs: [
          "--test",
          "--import",
          "@sfmc-bds/sdk/testing/minecraft-loader",
          "--import",
          "tsx/esm",
        ],
        args: ["${workspaceFolder}/test"],
        cwd: "${workspaceFolder}",
        console: "integratedTerminal",
        sourceMaps: true,
      },
    ],
  });
  writeJson(path.join(target, ".vscode", "tasks.json"), {
    version: "2.0.0",
    tasks: [
      {
        type: "npm",
        script: "typecheck",
        group: "build",
        problemMatcher: ["$tsc"],
        label: "npm: typecheck",
      },
      {
        type: "npm",
        script: "test",
        group: { kind: "test", isDefault: true },
        problemMatcher: [],
        label: "npm: test",
      },
      {
        type: "npm",
        script: "lint",
        problemMatcher: ["$eslint-stylish"],
        label: "npm: lint",
      },
    ],
  });
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
  const pkgName = official ? `@sfmc-bds/module-${folderId}` : `@CHANGE_ME/sfmc-module-${folderId}`;

  const sapiDir = path.join(target, "sapi");
  const schemaRel =
    "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@latest/modules/sdk/%40sfmc-sdk/schemas/sapi-manifest.v2.schema.json";

  writeJson(path.join(target, "package.json"), buildPackageJson(folderId, { official }));
  writeJson(path.join(sapiDir, "manifest.json"), buildManifest(folderId, displayName, template, schemaRel));
  writeJson(path.join(sapiDir, "tsconfig.json"), buildTsConfigStandalone());
  writeJson(path.join(target, "tsconfig.json"), buildRootTsConfig());
  writeText(path.join(sapiDir, "src", "index.ts"), buildIndexTs(folderId, displayName, pkgName));
  writeText(path.join(target, "test", `${folderId}.test.ts`), buildExampleTest(folderId, displayName));
  writeText(path.join(target, "eslint.config.js"), buildEslintConfigJs());
  writeText(path.join(target, ".gitignore"), buildGitignore());
  writeJson(path.join(target, ".prettierrc.json"), buildPrettierRc());
  writeText(path.join(target, ".prettierignore"), buildPrettierIgnore());
  writeText(path.join(target, "LICENSE"), buildLicense());
  writeText(path.join(target, "README.md"), buildReadme(folderId, displayName, pkgName));
  writeJson(path.join(target, ".sfmc", "sandbox-script.json"), buildSandboxScript(folderId, displayName));
  writeVscodeWorkspace(target);

  console.log(`[new-module] 已创建 ${target}`);
  console.log(`[new-module]   模式: 单包根`);
  console.log(`[new-module]   npm: ${pkgName}`);
  console.log(`[new-module]   manifest id: feature-${folderId}`);
  console.log(`[new-module]   下一步:`);
  console.log(`[new-module]     npm install && npm run typecheck && npm test && npm run lint`);
  console.log(
    `[new-module]     sfmc mod install ${folderId} --from dir:${target} --link  （在 SFMC 工作目录执行）`
  );
}

main();
