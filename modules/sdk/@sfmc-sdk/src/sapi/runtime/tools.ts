import { BlockComponentTypes, BlockPermutation, Dimension } from "@minecraft/server";

/** 判断二维点 (x,z) 是否落在矩形区域内（起终点可任意对角） */
export function pointInArea_2D(
  x: number,
  z: number,
  areaStart_x: number,
  areaStart_z: number,
  areaEnd_x: number,
  areaEnd_z: number
): boolean {
  if (areaStart_x < areaEnd_x) {
    if (x < areaStart_x || areaEnd_x < x) return false;
  } else {
    if (x < areaEnd_x || areaStart_x < x) return false;
  }
  if (areaStart_z < areaEnd_z) {
    if (z < areaStart_z || areaEnd_z < z) return false;
  } else {
    if (z < areaEnd_z || areaStart_z < z) return false;
  }
  return true;
}

/** 闭区间 [min, max] 内随机整数 */
export function getRandomInteger(min: number = 0, max: number = 1): number {
  return min + Math.floor(Math.random() * (max + 1));
}

/**
 * 将方向码映射为水平单位向量 `[dx, dz]`。
 * `1` 东 / `-1` 西 / `2` 南 / `-2` 北。
 */
export function getBase(direction: number): [number, number] {
  switch (direction) {
    case 1:
      return [1, 0];
    case -1:
      return [-1, 0];
    case 2:
      return [0, 1];
    case -2:
      return [0, -1];
    default:
      return [1, 0];
  }
}

/** 双箱放置用的 cardinal 朝向字符串（east/west/north/south） */
export function getChestCardinal(direction: number, face: number): string {
  if (direction === -1 || direction === 1) {
    return face > 0 ? "south" : "north";
  }
  return face > 0 ? "east" : "west";
}

/** 墙牌 `facing_direction` 数值（与箱子布局配套） */
export function getSignFacing(direction: number, face: number): number {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 3 : 2;
  }
  return face > 0 ? 5 : 4;
}

/**
 * 按主轴方向计算左箱 / 右箱 / 告示牌坐标。
 * 用于商店等「双箱 + 墙牌」布局。
 */
export function getLayout(
  start: [number, number, number],
  direction: number,
  mainAxis: number,
  yOffset: number,
  face: number
): {
  left: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  sign: { x: number; y: number; z: number };
} {
  const base = getBase(direction);
  const left = {
    x: start[0] + mainAxis * base[0] * 2,
    y: start[1] + yOffset,
    z: start[2] + mainAxis * base[1] * 2,
  };
  const right = {
    x: left.x + base[0],
    y: left.y,
    z: left.z + base[1],
  };
  const sign = {
    x: right.x + (base[0] !== 0 ? 0 : face),
    y: right.y,
    z: right.z + (base[1] !== 0 ? 0 : face),
  };
  return { left, right, sign };
}

/** 在指定位置确保存在一对朝向正确的双箱（已有箱子则跳过） */
export function ensureDoubleChest(
  dimension: Dimension,
  pos: { x: number; y: number; z: number },
  cardinal: string,
  direction: number
): void {
  const base = getBase(direction);
  for (const d of [0, 1]) {
    const p = {
      x: pos.x + (base[0] !== 0 ? d * base[0] : 0),
      y: pos.y,
      z: pos.z + (base[1] !== 0 ? d * base[1] : 0),
    };
    const block = dimension.getBlock(p);
    if (!block || block.typeId !== "minecraft:chest") {
      dimension.setBlockPermutation(p, BlockPermutation.resolve("chest", { "minecraft:cardinal_direction": cardinal }));
    }
  }
}

/** 放置墙牌并写入文本（失败时静默忽略） */
export function placeSign(
  dimension: Dimension,
  pos: { x: number; y: number; z: number },
  facing: number,
  text: string
): void {
  dimension.setBlockPermutation(pos, BlockPermutation.resolve("pale_oak_wall_sign", { facing_direction: facing }));
  try {
    const block = dimension.getBlock(pos);
    const sign = block?.getComponent(BlockComponentTypes.Sign) as any;
    if (sign) sign.setText(text);
  } catch {}
}

/** 返回东八区（上海）当前日期与时间字符串 */
export function getShanghaiTime(): { date: string; time: string } {
  const now = new Date();
  const offset = 8 * 60;
  const local = new Date(now.getTime() + offset * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,
  };
}

/** 将 Unix 毫秒时间戳格式化为东八区 `YYYY-MM-DD HH:mm` */
export function formatTimestamp(ts: number): string {
  const offset = 8 * 60;
  const d = new Date(ts + offset * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 业务实体 ID 前缀：CH 宝箱 / M 货币 / RP 领地 / L 日志 / CP 检查点 */
export type IDType = "CH" | "M" | "RP" | "L" | "CP";

/** 生成带前缀的短随机 ID，如 `CH_a1b2c3d4` */
export function generateId(type: IDType): string {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 维度 → 数值：主世界 0 / 下界 1 / 末地 2 */
export function dimensionId(dimension: Dimension): number {
  return dimension.id === "minecraft:overworld" ? 0 : dimension.id === "minecraft:nether" ? 1 : 2;
}

/** 将键值对象编码为 `?a=1&b=2`；空对象返回空串 */
export function toQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
}

/**
 * 列表表单体说明文案：首行加 `[*]`，末尾追加「请选择操作」。
 * 空数组仅返回「请选择操作」提示。
 */
export function ListFormInfo(str: string[]): string {
  if (str.length === 0) return "§7请选择操作：";
  const lines = [`[*] ${str[0]}`];
  if (str.length > 1) {
    const tail = str.slice(1);
    for (const line of tail) lines.push(line);
  }
  lines.push("");
  lines.push("§7请选择操作：");
  return lines.join("\n");
}
