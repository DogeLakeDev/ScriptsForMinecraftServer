/**
 * createModule — 从 templates/ 拷贝并渲染占位符，生成单包根模块仓。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertModuleId,
  renderTemplate,
  toConfigKey,
  toFeatureId,
  toPkgName,
  type TemplateVars,
} from "./render.js";

export type ModuleExtra = "db";

export interface CreateModuleOptions {
  /** 目标目录（须不存在或为空）。 */
  targetDir: string;
  /** 模块短 id（kebab-case）。 */
  id: string;
  /** 显示名；默认 = id。 */
  name?: string;
  /** 社区 npm scope（不含 @）；与 official 互斥。 */
  scope?: string;
  /** 官方包 @sfmc-bds/module-<id>。 */
  official?: boolean;
  /** 可选能力 overlay。 */
  extras?: ModuleExtra[];
}

export interface CreateModuleResult {
  targetDir: string;
  id: string;
  pkgName: string;
  featureId: string;
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function templatesRoot(): string {
  return path.join(packageRoot(), "templates");
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function isDirEmpty(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  return fs.readdirSync(dir).length === 0;
}

function copyRenderedTree(srcRoot: string, destRoot: string, vars: TemplateVars): void {
  for (const abs of listFilesRecursive(srcRoot)) {
    const rel = path.relative(srcRoot, abs);
    const renderedRel = renderTemplate(rel.replace(/\\/g, "/"), vars).replace(/\//g, path.sep);
    const dest = path.join(destRoot, renderedRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const raw = fs.readFileSync(abs, "utf8");
    const body = renderTemplate(raw, vars);
    fs.writeFileSync(dest, body, "utf8");
  }
}

function applyDbExtra(targetDir: string, vars: TemplateVars): void {
  const manifestPath = path.join(targetDir, "sapi", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    permissions?: string[];
    notes?: string;
  };
  const key = vars.configKey!;
  const perms = new Set(manifest.permissions ?? []);
  perms.add(`db:read:sfmc_${key}`);
  perms.add(`db:write:sfmc_${key}`);
  perms.add(`config:read:${key}`);
  manifest.permissions = [...perms];
  manifest.notes =
    `由 @sfmc-bds/create-module 生成（含 db 权限占位）。` +
    `请在 sapi/manifest.json 补全 routes/migrations，并在代码中使用 @sfmc-bds/sdk/sapi/db。`;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const indexPath = path.join(targetDir, "sapi", "src", "index.ts");
  let index = fs.readFileSync(indexPath, "utf8");
  if (!index.includes("@sfmc-bds/sdk/sapi/db")) {
    index = index.replace(
      /\/\* TODO: 读取 configs\//,
      `/* TODO(db): import { db } from "@sfmc-bds/sdk/sapi/db" 并声明表 */\n  /* TODO: 读取 configs/`
    );
    fs.writeFileSync(indexPath, index, "utf8");
  }
}

export async function createModule(opts: CreateModuleOptions): Promise<CreateModuleResult> {
  assertModuleId(opts.id);
  const id = opts.id;
  const name = (opts.name?.trim() || id).trim();
  const official = Boolean(opts.official);
  const pkgName = toPkgName({ id, official, scope: opts.scope });
  const configKey = toConfigKey(id);
  const featureId = toFeatureId(id);
  const cmdName = configKey;
  const year = String(new Date().getFullYear());
  const readyMsg = `模块 ${name} 已就绪`;

  const targetDir = path.resolve(opts.targetDir);
  if (fs.existsSync(targetDir) && !isDirEmpty(targetDir)) {
    throw new Error(`目标目录非空: ${targetDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const vars: TemplateVars = {
    id,
    name,
    pkgName,
    configKey,
    featureId,
    cmdName,
    year,
    readyMsg,
  };

  copyRenderedTree(path.join(templatesRoot(), "base"), targetDir, vars);

  const extras = opts.extras ?? [];
  for (const extra of extras) {
    if (extra === "db") {
      const overlay = path.join(templatesRoot(), "extras", "db");
      if (fs.existsSync(overlay)) {
        copyRenderedTree(overlay, targetDir, vars);
      }
      applyDbExtra(targetDir, vars);
    } else {
      throw new Error(`未知 extra: ${extra}`);
    }
  }

  return { targetDir, id, pkgName, featureId };
}
