/**
 * tools.ts — SAPI 常用空间几何、时间与文本辅助工具
 */

import { BlockComponentTypes, BlockPermutation, Dimension } from "@minecraft/server";

/**
 * 判断平面二维坐标点 (x, z) 是否落在指定的矩形区域内。
 * 起点与终点可为矩形的任意对角顶点（无需预先排序）。
 *
 * @param x 待测点的 X 坐标。
 * @param z 待测点的 Z 坐标。
 * @param areaStart_x 矩形区域顶点 A 的 X 坐标。
 * @param areaStart_z 矩形区域顶点 A 的 Z 坐标。
 * @param areaEnd_x 矩形区域对角顶点 B 的 X 坐标。
 * @param areaEnd_z 矩形区域对角顶点 B 的 Z 坐标。
 * @returns 若待测点在矩形范围内（含边界）则返回 `true`，否则返回 `false`。
 */
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

/**
 * 生成闭区间 `[min, max]` 内的随机整数。
 *
 * @param min 区间下界（默认为 0）。
 * @param max 区间上界（默认为 1）。
 * @returns 区间内的随机整数。
 */
export function getRandomInteger(min: number = 0, max: number = 1): number {
  return min + Math.floor(Math.random() * (max + 1));
}

/**
 * 将方向码映射为二维水平单位向量 `[dx, dz]`。
 *
 * 方向映射规则：
 * - `1`：东（+X）`[1, 0]`
 * - `-1`：西（-X）`[-1, 0]`
 * - `2`：南（+Z）`[0, 1]`
 * - `-2`：北（-Z）`[0, -1]`
 *
 * @param direction 方向代号。
 * @returns 二维平面步进向量。
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

/**
 * 计算用于放置箱子的 `cardinal_direction` 朝向属性值（"east" | "west" | "north" | "south"）。
 *
 * @param direction 主方向代号。
 * @param face 相对偏移正负符号。
 * @returns 方块朝向属性字符串。
 */
export function getChestCardinal(direction: number, face: number): string {
  if (direction === -1 || direction === 1) {
    return face > 0 ? "south" : "north";
  }
  return face > 0 ? "east" : "west";
}

/**
 * 获取悬挂墙牌所需的 `facing_direction` 数值属性（与箱子布局匹配）。
 *
 * @param direction 主方向代号。
 * @param face 相对偏移正负符号。
 * @returns 墙牌朝向数值。
 */
export function getSignFacing(direction: number, face: number): number {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 3 : 2;
  }
  return face > 0 ? 5 : 4;
}

/**
 * 计算双箱与墙牌布局中的左箱、右箱及告示牌的三维坐标。
 * 常用于商店柜台、领地箱等「双箱 + 墙牌」的标准布局计算。
 *
 * @param start 起始基准坐标 `[x, y, z]`。
 * @param direction 延伸方向代号。
 * @param mainAxis 沿主轴排列的序号索引。
 * @param yOffset Y 轴垂直偏移量。
 * @param face 朝向正面偏移量。
 * @returns 包含左箱、右箱与告示牌精确坐标的对象。
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

/**
 * 确保在指定坐标放置一对朝向正确的大型双箱；若对应位置已存在箱子方块则跳过。
 *
 * @param dimension 目标维度对象。
 * @param pos 基准放置坐标。
 * @param cardinal 箱子朝向字符串（"north" | "south" | "east" | "west"）。
 * @param direction 布局主方向代号。
 */
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

/**
 * 在指定坐标放置墙上告示牌并写入说明文本；若写入失败则静默忽略。
 *
 * @param dimension 目标维度对象。
 * @param pos 放置坐标。
 * @param facing 墙牌朝向数值。
 * @param text 写入告示牌的文本内容。
 */
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

/**
 * 获取当前系统时间的东八区（UTC+8 北京/上海时间）日期与时间字符串。
 *
 * @returns 包含 `date` ("YYYY-MM-DD") 与 `time` ("HH:mm:ss") 的对象。
 */
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

/**
 * 将给定的 Unix 毫秒时间戳格式化为东八区标准的 `YYYY-MM-DD HH:mm` 字符串。
 *
 * @param ts Unix 毫秒时间戳。
 * @returns 格式化后的时间字符串。
 */
export function formatTimestamp(ts: number): string {
  const offset = 8 * 60;
  const d = new Date(ts + offset * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 业务实体 ID 类型前缀：CH 宝箱 / M 货币 / RP 领地 / L 日志 / CP 检查点。 */
export type IDType = "CH" | "M" | "RP" | "L" | "CP";

/**
 * 生成带有业务类型前缀的随机短 ID（例如 `CH_a1b2c3d4`）。
 *
 * @param type 业务实体 ID 类型前缀。
 * @returns 带前缀的唯一随机字符串。
 */
export function generateId(type: IDType): string {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 将 Minecraft 维度对象转换为紧凑数值代号：
 * - 主世界（overworld）→ `0`
 * - 下界（nether）→ `1`
 * - 末地（the_end）→ `2`
 *
 * @param dimension 目标维度对象。
 * @returns 维度数值代号。
 */
export function dimensionId(dimension: Dimension): number {
  return dimension.id === "minecraft:overworld" ? 0 : dimension.id === "minecraft:nether" ? 1 : 2;
}

/**
 * 将键值字典编码为标准 URL 查询字符串（例如 `?a=1&b=2`）；若参数为空则返回空字符串。
 *
 * @param params 待序列化的键值对象。
 * @returns 格式化后的查询字符串（含开头的 `?`）。
 */
export function toQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
}

/**
 * 生成列表表单的正文说明文案：首行添加 `[*]` 标头，末尾追加“请选择操作：”提示。
 * 若传入空数组则直接返回默认的选择操作提示。
 *
 * @param str 文本说明行数组。
 * @returns 拼接后的表单说明正文字符串。
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

