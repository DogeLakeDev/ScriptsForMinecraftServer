#!/usr/bin/env node
/**
 * npm create @sfmc-bds/module → npx @sfmc-bds/create-module
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createModule, type ModuleExtra } from "./create-module.js";
import { assertModuleId, isValidModuleId } from "./render.js";

function parseArgs(argv: string[]) {
  const flags: {
    yes: boolean;
    id?: string;
    name?: string;
    scope?: string;
    official: boolean;
    extras: ModuleExtra[];
    out?: string;
  } = { yes: false, official: false, extras: [] };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--yes" || a === "-y") flags.yes = true;
    else if (a === "--official") flags.official = true;
    else if (a === "--id") flags.id = argv[++i];
    else if (a === "--name") flags.name = argv[++i];
    else if (a === "--scope") flags.scope = argv[++i];
    else if (a === "--out" || a === "--dir") flags.out = argv[++i];
    else if (a === "--extra") {
      const v = argv[++i];
      if (v === "db") flags.extras.push("db");
      else throw new Error(`未知 --extra: ${v}`);
    } else if (a.startsWith("--id=")) flags.id = a.slice(5);
    else if (a.startsWith("--name=")) flags.name = a.slice(7);
    else if (a.startsWith("--scope=")) flags.scope = a.slice(8);
    else if (a.startsWith("--out=") || a.startsWith("--dir=")) flags.out = a.slice(a.indexOf("=") + 1);
    else if (a.startsWith("--extra=")) {
      const v = a.slice(8);
      if (v === "db") flags.extras.push("db");
      else throw new Error(`未知 --extra: ${v}`);
    } else if (a === "--help" || a === "-h") {
      /* handled below */
    } else if (a.startsWith("-")) throw new Error(`未知参数: ${a}`);
    else positional.push(a);
  }
  if (!flags.id && positional[0]) flags.id = positional[0];
  if (!flags.out && positional[1]) flags.out = positional[1];
  return flags;
}

function printHelp(): void {
  console.log(`用法:
  npm create @sfmc-bds/module@latest
  npx @sfmc-bds/create-module@latest [id] [dir]

选项:
  --id <id>           模块短 id（kebab-case）
  --name <name>       显示名
  --scope <scope>     社区 npm scope（不含 @）
  --official          官方包 @sfmc-bds/module-<id>
  --extra db          附加 db 权限占位
  --out <dir>         输出目录（默认 ./<id>）
  -y, --yes           非交互（须给齐 --id 与 --scope/--official）
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  let flags;
  try {
    flags = parseArgs(argv);
  } catch (e) {
    console.error(pc.red(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }

  p.intro(pc.bgCyan(pc.black(" SFMC create-module ")));

  let id = flags.id;
  let name = flags.name;
  let official = flags.official;
  let scope = flags.scope;
  let extras = flags.extras;
  let out = flags.out;

  if (!flags.yes) {
    if (!id) {
      const v = await p.text({
        message: "模块 id（kebab-case）",
        placeholder: "my-feature",
        validate: (s) => {
          if (!s || !isValidModuleId(s)) return "须为小写 kebab-case，且不含 feature-/core- 前缀";
          if (s.startsWith("feature-") || s.startsWith("core-")) return "不要带 feature-/core- 前缀";
        },
      });
      if (p.isCancel(v)) {
        p.cancel("已取消");
        process.exit(0);
      }
      id = v;
    }

    if (!name) {
      const v = await p.text({
        message: "显示名",
        defaultValue: id,
        placeholder: id,
      });
      if (p.isCancel(v)) {
        p.cancel("已取消");
        process.exit(0);
      }
      name = v || id;
    }

    if (!official && !scope) {
      const kind = await p.select({
        message: "npm 包范围",
        options: [
          { value: "community", label: "社区", hint: "@<scope>/sfmc-module-<id>" },
          { value: "official", label: "官方", hint: "@sfmc-bds/module-<id>" },
        ],
      });
      if (p.isCancel(kind)) {
        p.cancel("已取消");
        process.exit(0);
      }
      if (kind === "official") official = true;
      else {
        const s = await p.text({
          message: "npm scope（不含 @）",
          placeholder: "alice",
          validate: (x) => (!x?.trim() ? "必填" : undefined),
        });
        if (p.isCancel(s)) {
          p.cancel("已取消");
          process.exit(0);
        }
        scope = s.trim().replace(/^@/, "");
      }
    }

    if (extras.length === 0) {
      const picked = await p.multiselect({
        message: "可选能力（空格选择，回车确认）",
        options: [{ value: "db", label: "db", hint: "manifest 增加 db 读写权限占位" }],
        required: false,
      });
      if (p.isCancel(picked)) {
        p.cancel("已取消");
        process.exit(0);
      }
      extras = picked as ModuleExtra[];
    }

    if (!out) {
      const v = await p.text({
        message: "输出目录",
        defaultValue: `./${id}`,
        placeholder: `./${id}`,
      });
      if (p.isCancel(v)) {
        p.cancel("已取消");
        process.exit(0);
      }
      out = v || `./${id}`;
    }
  }

  if (!id) {
    console.error(pc.red("非交互模式须提供 --id"));
    process.exit(1);
  }
  try {
    assertModuleId(id);
  } catch (e) {
    console.error(pc.red(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
  if (!official && !scope) {
    console.error(pc.red("须提供 --scope 或 --official"));
    process.exit(1);
  }

  const targetDir = path.resolve(out || `./${id}`);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(pc.red(`目标目录非空: ${targetDir}`));
    process.exit(1);
  }

  const spin = p.spinner();
  spin.start("正在生成模块…");
  try {
    const result = await createModule({
      targetDir,
      id,
      name: name || id,
      scope,
      official,
      extras,
    });
    spin.stop(`已创建 ${result.pkgName}`);
    p.note(
      [
        `cd ${path.relative(process.cwd(), result.targetDir) || "."}`,
        "npm install",
        "npm test",
        "",
        "联调：扩展 SFMC: Link to SFMC Root，或：",
        `sfmc mod install ${result.id} --from dir:${result.targetDir} --link`,
      ].join("\n"),
      "下一步"
    );
    p.outro(pc.green("完成"));
  } catch (e) {
    spin.stop("失败");
    console.error(pc.red(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
}

main();
