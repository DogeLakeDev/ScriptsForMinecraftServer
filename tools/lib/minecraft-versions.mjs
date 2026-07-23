/**
 * tools/lib/minecraft-versions.mjs — @minecraft/* 版本权威来源与扫描
 *
 * 权威版本：主仓根 package.json 的 devDependencies（@minecraft/*），
 * 安装时以 overrides 为准；校验时 devDependencies 须为精确版本（无 ^/~/>）。
 */
import fs from "node:fs";
import path from "node:path";

/** SDK 允许 peer 使用最低兼容范围；业务模块不得自行声明 @minecraft/* */
export const SDK_PEER_RANGE_ALLOWED = new Set(["@sfmc-bds/sdk", "@sfmc/sdk"]);

const MIN_RANGE_RE = /^>=/;

/** 业务模块包名：@sfmc-bds/module-* */
export function isBusinessModulePkg(pkgName) {
  return typeof pkgName === "string" && pkgName.startsWith("@sfmc-bds/module-");
}

/**
 * @param {Record<string, string>} devDeps
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string>}
 */
export function readCanonicalVersions(devDeps, overrides = {}) {
  /** @type {Record<string, string>} */
  const canonical = {};
  for (const [name, ver] of Object.entries(devDeps ?? {})) {
    if (name.startsWith("@minecraft/")) canonical[name] = ver;
  }
  for (const [name, ver] of Object.entries(overrides ?? {})) {
    if (name.startsWith("@minecraft/")) canonical[name] = ver;
  }
  return canonical;
}

/**
 * @param {string} root 仓库根
 * @returns {Record<string, string>}
 */
export function readCanonicalFromRootPkg(root) {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return readCanonicalVersions(pkg.devDependencies, pkg.overrides);
}

/**
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
export function findPackageJsonFiles(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      findPackageJsonFiles(full, acc);
    } else if (ent.name === "package.json") {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * @param {string} pkgPath
 * @returns {{ rel: string, name: string, deps: Record<string, string> }}
 */
export function readMinecraftDeps(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  /** @type {Record<string, string>} */
  const deps = {};
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [name, ver] of Object.entries(pkg[section] ?? {})) {
      if (name.startsWith("@minecraft/")) deps[name] = ver;
    }
  }
  return { rel: pkgPath, name: pkg.name ?? pkgPath, deps };
}

/**
 * devDependencies 中的 @minecraft/* 必须为精确版本（约束写入点）
 * @param {Record<string, string>} devDeps
 * @returns {string[]}
 */
export function validateCanonicalPins(devDeps) {
  /** @type {string[]} */
  const errors = [];
  for (const [name, ver] of Object.entries(devDeps ?? {})) {
    if (!name.startsWith("@minecraft/")) continue;
    if (/^[\^~>]/.test(ver) || ver.includes("||") || ver.includes(" - ")) {
      errors.push(`根 devDependencies ${name}="${ver}" 须改为精确版本`);
    }
  }
  return errors;
}

/**
 * @param {Record<string, string>} overrides
 * @param {Record<string, string>} canonical
 * @returns {string[]}
 */
export function validateOverrides(overrides, canonical) {
  /** @type {string[]} */
  const errors = [];
  for (const name of Object.keys(canonical)) {
    if (!overrides[name]) {
      errors.push(`根 overrides 缺少 ${name}（应与 devDependencies 一致）`);
    } else if (overrides[name] !== canonical[name]) {
      errors.push(
        `根 overrides ${name}="${overrides[name]}" 与 devDependencies="${canonical[name]}" 不一致`
      );
    }
  }
  return errors;
}

/**
 * @param {object} opts
 * @param {Record<string, string>} opts.canonical
 * @param {string} opts.pkgPath
 * @param {string} opts.pkgName
 * @param {Record<string, string>} opts.deps
 * @returns {string[]}
 */
export function validatePackageMinecraftDeps({ canonical, pkgPath, pkgName, deps }) {
  /** @type {string[]} */
  const errors = [];
  const allowRange = SDK_PEER_RANGE_ALLOWED.has(pkgName);

  // 业务模块：类型来自仓库根 hoisted devDependencies，不得再声明 @minecraft/*
  if (isBusinessModulePkg(pkgName) && Object.keys(deps).length > 0) {
    for (const [name, ver] of Object.entries(deps)) {
      errors.push(
        `${pkgPath}: 业务模块勿声明 ${name}="${ver}"（请只用仓库根 devDependencies pin）`
      );
    }
    return errors;
  }

  for (const [name, ver] of Object.entries(deps)) {
    const expected = canonical[name];
    if (!expected) {
      errors.push(`${pkgPath}: 未在权威清单中声明的 ${name}="${ver}"`);
      continue;
    }
    if (allowRange && MIN_RANGE_RE.test(ver)) continue;
    if (ver !== expected) {
      errors.push(`${pkgPath}: ${name}="${ver}" 应为 "${expected}"`);
    }
    if (!allowRange && /^[\^~>]/.test(ver)) {
      errors.push(`${pkgPath}: ${name}="${ver}" 须精确 pin，勿用范围`);
    }
  }
  return errors;
}
