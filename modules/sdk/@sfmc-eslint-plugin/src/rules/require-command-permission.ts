import fs from "node:fs";
import path from "node:path";
import { createRule } from "../utils/create-rule.js";
import { isStringLiteral } from "../utils/ast.js";

const permCache = new Map<string, Set<string>>();

function collectPermissionsInPackage(filename: string): Set<string> {
  const abs = path.resolve(filename).replace(/\\/g, "/");
  const sapiSrc = abs.match(/^(.*\/sapi\/src)(?:\/|$)/);
  // 非模块包路径：不扫磁盘，仅依赖同文件 AST（避免误命中仓库其它文件）
  if (!sapiSrc) return new Set();
  const root = sapiSrc[1]!;
  if (permCache.has(root)) return permCache.get(root)!;

  const found = new Set<string>();
  if (!fs.existsSync(root)) {
    permCache.set(root, found);
    return found;
  }
  const re = /Permission\.register\s*\(\s*["']([^"']+)["']/g;

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        walk(p);
      } else if (/\.(ts|js|mts|cts)$/.test(e.name)) {
        try {
          const text = fs.readFileSync(p, "utf8");
          let m: RegExpExecArray | null;
          re.lastIndex = 0;
          while ((m = re.exec(text))) found.add(m[1]!);
        } catch {
          /* ignore */
        }
      }
    }
  }

  walk(root);
  permCache.set(root, found);
  return found;
}

/**
 * Command.register 字符串权限须同包 Permission.register
 */
export const requireCommandPermission = createRule({
  name: "require-command-permission",
  meta: {
    type: "suggestion",
    docs: {
      description: "Command.register 的字符串权限须在同包 Permission.register",
    },
    messages: {
      missing:
        '权限 "{{perm}}" 未在同包 Permission.register。请在 registerPermissions 中注册后再 Command.register。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    const localPerms = new Set<string>();

    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.computed) return;
        if (node.callee.property.type !== "Identifier") return;
        if (node.callee.object.type !== "Identifier") return;

        if (
          node.callee.object.name === "Permission" &&
          node.callee.property.name === "register" &&
          isStringLiteral(node.arguments[0])
        ) {
          localPerms.add(node.arguments[0].value);
          return;
        }

        if (
          node.callee.object.name !== "Command" ||
          node.callee.property.name !== "register"
        ) {
          return;
        }
        const permArg = node.arguments[1];
        if (!isStringLiteral(permArg)) return; // 数字 level 合法
        const perm = permArg.value;
        const packagePerms = collectPermissionsInPackage(filename);
        if (localPerms.has(perm) || packagePerms.has(perm)) return;
        context.report({ node: permArg, messageId: "missing", data: { perm } });
      },
    };
  },
});
