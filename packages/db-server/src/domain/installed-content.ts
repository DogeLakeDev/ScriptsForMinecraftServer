/**
 * domain/installed-content.ts — 只读汇总已装模块与世界行为包、资源包。
 *
 * 供 QQ「模块 / 世界包」查询。模块启停仍以 catalog + lock 为准；
 * 世界包名单与显示名跟 CLI 同一条路径：listInstalledWorldPacks 会解析 pack.name 这类语言键。
 */

import fs from "node:fs";
import path from "node:path";
import { listInstalledWorldPacks } from "@sfmc-bds/bds-tools/world-packs";

/** 一条已安装模块。has_resource_pack 表示该模块目录下有 resource_pack。 */
export type ContentModule = {
  id: string;
  display_name: string;
  enabled: boolean;
  has_resource_pack: boolean;
};

/** 世界里已安装的行为包或资源包。name 是解析后的显示名，不再保留 pack.name 这种语言键。 */
export type WorldPackKind = "behavior" | "resource";

export type WorldPackEntry = {
  kind: WorldPackKind;
  name: string;
  folder_name: string;
  pack_id: string;
  version: string;
  enabled: boolean;
};

/** 世界 world_resource_packs.json 里的一条已启用资源包。旧查询仍读这个字段。 */
export type WorldResourcePack = {
  name: string;
  pack_id: string;
  version: string;
};

export type ContentSnapshot = {
  success: true;
  modules: ContentModule[];
  /** 行为包与资源包分开列出，顺序与 CLI list 一致。 */
  packs: WorldPackEntry[];
  resource_packs: WorldResourcePack[];
  /** 读不到 BDS 世界时说明原因；模块列表仍然返回。 */
  note?: "bds_unconfigured" | "world_unread";
};

type CatalogModule = {
  id: string;
  display_name: string;
  enabled: boolean;
};

/**
 * 从 server.properties 文本取出 level-name。
 * 缺省时用 BDS 默认世界名，供拼 worlds/<level>/world_resource_packs.json。
 */
export function parseLevelName(serverPropertiesText: string): string {
  const matched = serverPropertiesText.match(/^level-name=(.*)$/m);
  const name = matched?.[1]?.trim();
  return name && name.length > 0 ? name : "Bedrock level";
}

/** 解析世界资源包启用列表。损坏或不是数组时返回空列表。 */
export function parseWorldResourcePackList(raw: unknown): Array<{ pack_id: string; version: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ pack_id: string; version: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const packId = (entry as { pack_id?: unknown }).pack_id;
    if (typeof packId !== "string" || !packId.trim()) continue;
    const ver = (entry as { version?: unknown }).version;
    const version =
      Array.isArray(ver) && ver.length >= 3 ? `${Number(ver[0])}.${Number(ver[1])}.${Number(ver[2])}` : "";
    out.push({ pack_id: packId.trim(), version });
  }
  return out;
}

/**
 * 语言键没解析出来时，用文件夹名代替。
 * 与 CLI 自检里对 pack / pack.* 的回退一致，避免 QQ 上继续显示 pack.name。
 */
export function worldPackDisplayName(name: string, folderName: string): string {
  const raw = name.trim();
  if (!raw || raw.startsWith("pack.") || raw === "pack") return folderName;
  return raw;
}

function readJsonObject(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 收集带 resource_pack 目录的模块标识。
 * 同时收录文件夹名和 sapi/manifest.json 的 id，便于和 catalog 的模块 id 对上。
 */
export function indexModuleResourcePacks(packagesDir: string): Set<string> {
  const ids = new Set<string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return ids;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const modPath = path.join(packagesDir, entry.name);
    try {
      if (!fs.statSync(modPath).isDirectory()) continue;
    } catch {
      continue;
    }
    const rpDir = path.join(modPath, "resource_pack");
    try {
      if (!fs.statSync(rpDir).isDirectory()) continue;
    } catch {
      continue;
    }
    ids.add(entry.name);
    const manifest = readJsonObject(path.join(modPath, "sapi", "manifest.json"));
    const logicalId = manifest && typeof manifest.id === "string" ? manifest.id.trim() : "";
    if (logicalId) ids.add(logicalId);
  }
  return ids;
}

/** 给 catalog 模块标上是否自带资源包。当前查询页用这个标记区分「含资源包」。 */
export function markModuleResourcePacks(modules: CatalogModule[], resourcePackIds: Set<string>): ContentModule[] {
  return modules.map((mod) => ({
    id: mod.id,
    display_name: mod.display_name,
    enabled: mod.enabled,
    has_resource_pack: resourcePackIds.has(mod.id),
  }));
}

/** 扫描世界已安装的行为包和资源包。显示名走 CLI 的 manifest 语言解析。 */
export function readInstalledWorldPacks(bdsRoot: string, levelName: string): WorldPackEntry[] {
  return listInstalledWorldPacks(bdsRoot, levelName).map((pack) => ({
    kind: pack.kind,
    name: worldPackDisplayName(pack.name, pack.folderName),
    folder_name: pack.folderName,
    pack_id: pack.uuid,
    version: `${pack.version[0]}.${pack.version[1]}.${pack.version[2]}`,
    enabled: pack.enabled,
  }));
}

/**
 * 读取某个世界已启用的资源包，并用 CLI 解析出的显示名补上。
 * 目录对不上时仍返回 pack_id，避免启用列表被吞掉。
 * installed 传入时复用同一次扫描，避免再读一遍包目录。
 */
export function readEnabledWorldResourcePacks(
  bdsRoot: string,
  levelName: string,
  installed?: WorldPackEntry[]
): WorldResourcePack[] {
  const byUuid = new Map(
    (installed ?? readInstalledWorldPacks(bdsRoot, levelName))
      .filter((pack) => pack.kind === "resource")
      .map((pack) => [pack.pack_id.toLowerCase(), pack])
  );
  const listFile = path.join(bdsRoot, "worlds", levelName, "world_resource_packs.json");
  let listed: Array<{ pack_id: string; version: string }> = [];
  try {
    listed = parseWorldResourcePackList(JSON.parse(fs.readFileSync(listFile, "utf8")) as unknown);
  } catch {
    return [...byUuid.values()]
      .filter((pack) => pack.enabled)
      .map((pack) => ({ name: pack.name, pack_id: pack.pack_id, version: pack.version }));
  }
  return listed.map((entry) => {
    const known = byUuid.get(entry.pack_id.toLowerCase());
    return {
      name: known?.name || entry.pack_id,
      pack_id: entry.pack_id,
      version: known?.version || entry.version,
    };
  });
}

/**
 * 组装 QQ 查询用的快照。
 * packagesDir 是 modules/packages；bdsRoot 为空时只返回模块，并带 bds_unconfigured。
 */
export function loadContentSnapshot(opts: {
  packagesDir: string;
  modules: CatalogModule[];
  bdsRoot: string | null;
}): ContentSnapshot {
  const modules = markModuleResourcePacks(opts.modules, indexModuleResourcePacks(opts.packagesDir));
  const unread = (note: "bds_unconfigured" | "world_unread"): ContentSnapshot => ({
    success: true,
    modules,
    packs: [],
    resource_packs: [],
    note,
  });
  if (!opts.bdsRoot) return unread("bds_unconfigured");
  const propsFile = path.join(opts.bdsRoot, "server.properties");
  let levelName = "Bedrock level";
  try {
    levelName = parseLevelName(fs.readFileSync(propsFile, "utf8"));
  } catch {
    return unread("world_unread");
  }
  const worldDir = path.join(opts.bdsRoot, "worlds", levelName);
  try {
    if (!fs.statSync(worldDir).isDirectory()) return unread("world_unread");
  } catch {
    return unread("world_unread");
  }
  let packs: WorldPackEntry[];
  try {
    packs = readInstalledWorldPacks(opts.bdsRoot, levelName);
  } catch {
    return unread("world_unread");
  }
  return {
    success: true,
    modules,
    packs,
    resource_packs: readEnabledWorldResourcePacks(opts.bdsRoot, levelName, packs),
  };
}
