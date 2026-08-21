/**
 * 模板占位符渲染：{{key}} → vars[key]
 */

export type TemplateVars = Record<string, string>;

export function renderTemplate(input: string, vars: TemplateVars): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) {
      throw new Error(`模板缺少占位符变量: {{${key}}}`);
    }
    return vars[key]!;
  });
}

export function isValidModuleId(id: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}

export function assertModuleId(id: string): void {
  if (!isValidModuleId(id)) {
    throw new Error(`id 须为小写 kebab-case（如 my-feature），收到: ${id}`);
  }
  if (id.startsWith("feature-") || id.startsWith("core-")) {
    throw new Error(`id 须为短名（不含 feature-/core- 前缀），例如 area 而非 feature-area`);
  }
}

export function toConfigKey(id: string): string {
  return id.replace(/-/g, "_");
}

export function toFeatureId(id: string): string {
  return `feature-${id}`;
}

export function toPkgName(opts: { id: string; official?: boolean; scope?: string }): string {
  if (opts.official) return `@sfmc-bds/module-${opts.id}`;
  const scope = (opts.scope || "").replace(/^@/, "").trim();
  if (!scope) {
    throw new Error("社区包须提供 npm scope（如 alice），或使用 official: true");
  }
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(scope)) {
    throw new Error(`非法 npm scope: ${scope}`);
  }
  return `@${scope}/sfmc-module-${opts.id}`;
}
