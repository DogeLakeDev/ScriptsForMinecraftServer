/**
 * 从 data-land.json + data-coop.json 提取领地信息表格
 * 输出 CSV：land_id, nickname, describe, share_users, range
 *
 * 用法：node tools/extract-land-table.js [--output result.csv]
 *       默认输出到 stdout
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ── 命令行参数 ──
const args = process.argv.slice(2);
const outputArg = args.find((a) => a.startsWith("--output=") || a.startsWith("-o="));
const OUTPUT = outputArg ? outputArg.split("=", 2)[1] : null;

// ── 工具函数 ──

/** 去掉 Minecraft 格式码 §x */
function stripFormatCodes(text) {
  if (typeof text !== "string") return text;
  return text.replace(/§[0-9a-gklmnors]/gi, "");
}

/** 维度名称映射 */
const DIM_NAMES = { 0: "主世界", 1: "下界", 2: "末地" };
function formatRange(range) {
  if (!range) return "";
  const [sx, sy, sz] = range.start_position || [0, 0, 0];
  const [ex, ey, ez] = range.end_position || [0, 0, 0];
  const dim = DIM_NAMES[range.dimid] || `dim${range.dimid}`;
  return `(${sx},${sy},${sz})→(${ex},${ey},${ez})[${dim}]`;
}

// ── 步骤 1：构建 xuid → 玩家名 映射 ──

function buildXuidMap(coopData) {
  const map = new Map();
  const allData = Array.isArray(coopData) ? coopData : (coopData.data || []);
  for (const coop of allData) {
    const members = coop.members || [];
    for (const m of members) {
      if (m.xuid && m.name && !map.has(String(m.xuid))) {
        map.set(String(m.xuid), stripFormatCodes(m.name));
      }
    }
  }
  return map;
}

// ── 步骤 2：遍历领地提取数据 ──

function extractLands(landData, xuidMap) {
  const lands = landData.Lands || landData || {};
  const rows = [];

  for (const [landId, land] of Object.entries(lands)) {
    if (!land || typeof land !== "object") continue;
    const s = land.settings || {};
    const r = land.range || {};

    const nickname = stripFormatCodes(s.nickname || "");
    const describe = stripFormatCodes(s.describe || "");
    const shareXuids = Array.isArray(s.share) ? s.share : [];

    const shareUsers = shareXuids.map((xuid) => {
      const name = xuidMap.get(String(xuid));
      return name || `[未知:${xuid}]`;
    });

    const rangeStr = formatRange(r);

    rows.push({
      land_id: landId,
      nickname,
      describe,
      share_users: shareUsers.join(", "),
      range: rangeStr,
    });
  }

  return rows;
}

// ── 步骤 3：生成 CSV ──

function escapeCsvField(val) {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  const header = ["land_id", "nickname", "describe", "share_users", "range"];
  const lines = [header.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(header.map((k) => escapeCsvField(row[k])).join(","));
  }
  // UTF-8 BOM 确保 Excel 正确识别中文
  return "\uFEFF" + lines.join("\r\n");
}

// ── 主流程 ──

function main() {
  const coopPath = path.join(ROOT, "data-coop.json");
  const landPath = path.join(ROOT, "data-land.json");

  if (!fs.existsSync(coopPath)) {
    console.error("❌ 找不到 data-coop.json");
    process.exit(1);
  }
  if (!fs.existsSync(landPath)) {
    console.error("❌ 找不到 data-land.json");
    process.exit(1);
  }

  console.error("📖 读取 data-coop.json ...");
  const coopRaw = fs.readFileSync(coopPath, "utf-8");
  const coopData = JSON.parse(coopRaw);
  const xuidMap = buildXuidMap(coopData);
  const memberCount = Array.isArray(coopData) ? coopData.reduce((s, c) => s + (c.members?.length || 0), 0) : (coopData.data || []).reduce((s, c) => s + (c.members?.length || 0), 0);
  console.error(`   ✓ 找到 ${memberCount} 个成员，${xuidMap.size} 个唯一 xuid`);

  console.error("📖 读取 data-land.json ...");
  const landRaw = fs.readFileSync(landPath, "utf-8");
  const landData = JSON.parse(landRaw);
  const rows = extractLands(landData, xuidMap);
  console.error(`   ✓ 提取 ${rows.length} 条领地记录`);

  const csv = toCsv(rows);

  if (OUTPUT) {
    fs.writeFileSync(path.resolve(ROOT, OUTPUT), csv, "utf-8");
    console.error(`✅ 已写入 ${OUTPUT} (${rows.length} 行)`);
  } else {
    process.stdout.write(csv);
  }
}

main();
