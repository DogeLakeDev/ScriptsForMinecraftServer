/**
 * content-format.ts — 把模块 / 世界包快照排成 QQ 信息卡正文。
 *
 * 「模块」列出启停和是否自带资源包。
 * 「世界包」的 Markdown 用表格分列行为包和资源包；纯文本仍保留原来的逐行列表，供 Markdown 发送失败时降级。
 */

export type ContentModuleView = {
  id: string;
  display_name?: string;
  enabled?: boolean;
  has_resource_pack?: boolean;
};

/** 一条世界包。kind 缺省时按资源包处理，兼容还没分开返回的旧快照。 */
export type WorldPackView = {
  kind?: "behavior" | "resource";
  name?: string;
  folder_name?: string;
  pack_id?: string;
  version?: string;
  enabled?: boolean;
};

/** 关键字匹配模块名或 id。空关键字表示全部。 */
export function moduleMatches(mod: ContentModuleView, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  const name = String(mod.display_name || mod.id || "").toLowerCase();
  return name.includes(q) || String(mod.id || "").toLowerCase().includes(q);
}

/** 模块查询正文。已启用排在前面，便于在群里扫一眼当前在跑什么。 */
export function formatModuleLines(modules: ContentModuleView[], keyword = ""): string[] {
  const matched = modules.filter((mod) => moduleMatches(mod, keyword));
  if (!matched.length) {
    return keyword ? [`没有名称包含「${keyword}」的模块。`] : ["当前没有已安装模块。"];
  }
  const enabled = matched.filter((mod) => mod.enabled !== false);
  const disabled = matched.filter((mod) => mod.enabled === false);
  const lines = [`已启用 ${enabled.length}，未启用 ${disabled.length}`];
  const render = (mod: ContentModuleView) => {
    const name = mod.display_name || mod.id || "未命名模块";
    const state = mod.enabled === false ? "关" : "开";
    const pack = mod.has_resource_pack ? " · 含资源包" : "";
    return `${name}（${state}${pack}）`;
  };
  if (enabled.length) {
    lines.push("", "【已启用】", ...enabled.map(render));
  }
  if (disabled.length) {
    lines.push("", "【未启用】", ...disabled.map(render));
  }
  return lines;
}

/** 单条世界包：真实名称优先，语言键残留时退回文件夹名。 */
function formatWorldPackLine(pack: WorldPackView): string {
  const resolved = String(pack.name || "").trim();
  const folder = String(pack.folder_name || "").trim();
  const name =
    !resolved || resolved.startsWith("pack.") || resolved === "pack"
      ? folder || pack.pack_id || "未命名"
      : resolved;
  const folderBit = folder && folder !== name ? `${folder} · ` : "";
  const version = pack.version ? ` v${pack.version}` : "";
  const state = pack.enabled === false ? "关" : "开";
  return `${folderBit}${name}${version}（${state}）`;
}

/** 表格单元格：去掉基岩版颜色码，并转义会拆列的竖线。 */
function markdownCell(value: string): string {
  const text = value.replace(/§[0-9a-zA-Z]/g, "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  return text || "—";
}

/** 与纯文本列表同一套名称回退：语言键残留时用文件夹名。 */
function packFields(pack: WorldPackView): { state: string; name: string; version: string } {
  const resolved = String(pack.name || "").trim();
  const folder = String(pack.folder_name || "").trim();
  const name =
    !resolved || resolved.startsWith("pack.") || resolved === "pack"
      ? folder || pack.pack_id || "未命名"
      : resolved;
  return {
    state: pack.enabled === false ? "关" : "开",
    name: markdownCell(name),
    version: markdownCell(pack.version || "—"),
  };
}

function markdownTable(rows: Array<{ state: string; name: string; version: string }>): string[] {
  return [
    "| 状态 | 名称 | 版本 |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.state} | ${row.name} | ${row.version} |`),
  ];
}

/**
 * 世界包的 Markdown 正文。行为包、资源包各一张表，已启用排在前面。
 * 读不到世界时只给说明，不输出空表。
 */
export function formatPackMarkdown(packs: WorldPackView[], worldNote?: string): string {
  if (worldNote === "bds_unconfigured") {
    return ["## 世界包", "", "未配置 BDS 路径，暂时无法读取世界行为包和资源包。"].join("\n");
  }
  if (worldNote === "world_unread") {
    return ["## 世界包", "", "世界行为包和资源包暂时读不出来。"].join("\n");
  }
  const sections: Array<{ kind: "behavior" | "resource"; title: string; empty: string }> = [
    { kind: "behavior", title: "行为包", empty: "世界里没有行为包。" },
    { kind: "resource", title: "资源包", empty: "世界里没有资源包。" },
  ];
  const lines = ["## 世界包", ""];
  for (const section of sections) {
    const group = packs.filter((pack) => (pack.kind ?? "resource") === section.kind);
    const enabled = group.filter((pack) => pack.enabled !== false);
    const disabled = group.filter((pack) => pack.enabled === false);
    lines.push(`### ${section.title}`, "");
    if (!group.length) {
      lines.push(section.empty, "");
      continue;
    }
    lines.push(`已启用 ${enabled.length}，未启用 ${disabled.length}`, "");
    lines.push(...markdownTable([...enabled, ...disabled].map(packFields)), "");
  }
  return lines.join("\n").trimEnd();
}

/**
 * 世界包查询正文。行为包和资源包分开展示，已启用排在前面。
 * worldNote 来自 db-server：未配置 BDS 或世界目录读失败时只说明原因。
 */
export function formatPackLines(packs: WorldPackView[], worldNote?: string): string[] {
  if (worldNote === "bds_unconfigured") return ["未配置 BDS 路径，暂时无法读取世界行为包和资源包。"];
  if (worldNote === "world_unread") return ["世界行为包和资源包暂时读不出来。"];
  const sections: Array<{ kind: "behavior" | "resource"; title: string; empty: string }> = [
    { kind: "behavior", title: "【行为包】", empty: "世界里没有行为包。" },
    { kind: "resource", title: "【资源包】", empty: "世界里没有资源包。" },
  ];
  const lines: string[] = [];
  for (const section of sections) {
    const group = packs.filter((pack) => (pack.kind ?? "resource") === section.kind);
    const enabled = group.filter((pack) => pack.enabled !== false);
    const disabled = group.filter((pack) => pack.enabled === false);
    if (lines.length) lines.push("");
    lines.push(section.title);
    if (!group.length) {
      lines.push(section.empty);
      continue;
    }
    lines.push(`已启用 ${enabled.length}，未启用 ${disabled.length}`);
    lines.push(...enabled.map(formatWorldPackLine), ...disabled.map(formatWorldPackLine));
  }
  return lines;
}
