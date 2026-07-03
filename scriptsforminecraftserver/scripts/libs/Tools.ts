import { world, BlockPermutation, BlockComponentTypes, Dimension, Player } from "@minecraft/server";

// 判断坐标是否在某区域内 (2D, 包含边界)
export function pointInArea_2D(x: number, z: number, areaStart_x: number, areaStart_z: number, areaEnd_x: number, areaEnd_z: number) {
  if (areaStart_x < areaEnd_x) {
    if (x < areaStart_x || areaEnd_x < x) {
      return false;
    }
  }
  else {
    if (x < areaEnd_x || areaStart_x < x) {
      return false;
    }
  }
  if (areaStart_z < areaEnd_z) {
    if (z < areaStart_z || areaEnd_z < z) {
      return false;
    }
  }
  else {
    if (z < areaEnd_z || areaStart_z < z) {
      return false;
    }
  }
  return true;

}
export function pointInArea_3D(x: number, y: number, z: number, areaStart_x: number, areaStart_y: number, areaStart_z: number, areaEnd_x: number, areaEnd_y: number, areaEnd_z: number) {
  if (areaStart_x < areaEnd_x) {
    if (x < areaStart_x || areaEnd_x < x) {
      return false;
    }
  }
  else {
    if (x < areaEnd_x || areaStart_x < x) {
      return false;
    }
  }
  if (areaStart_y < areaEnd_y) {
    if (y < areaStart_y || areaEnd_y < y) {
      return false;
    }
  }
  else {
    if (y < areaEnd_y || areaStart_y < y) {
      return false;
    }
  }
  if (areaStart_z < areaEnd_z) {
    if (z < areaStart_z || areaEnd_z < z) {
      return false;
    }
  }
  else {
    if (z < areaEnd_z || areaStart_z < z) {
      return false;
    }
  }
  return true;
}

export function playerCMDName(name: string) {
  if (name.indexOf(' ') !== -1) {
    return '"' + name + '"'
  }
  return name;
}

export function logger(str: string) {
  for (let player of world.getPlayers()) {
    player.sendMessage({ rawtext: [{ "text": `${str}` }] })
  }
}

/**
 * 获取随机整数 两边都是闭区间
 */
export function getRandomInteger(min: number = 0, max: number = 1) {
  return min + Math.floor(Math.random() * (max + 1))
}

// ============================================
//  双箱子布局工具
// ============================================

/** 根据 direction 获取增长方向基向量 */
export function getBase(direction: number): [number, number] {
  switch (direction) {
    case 1: return [1, 0];
    case -1: return [-1, 0];
    case 2: return [0, 1];
    case -2: return [0, -1];
    default: return [1, 0];
  }
}

/** 获取箱子面朝方向（与 Clean 一致） */
export function getChestCardinal(direction: number, face: number): string {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 'south' : 'north';
  }
  return face > 0 ? 'east' : 'west';
}

/** 获取墙上告示牌的面朝方向（与 Clean 一致） */
export function getSignFacing(direction: number, face: number): number {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 3 : 2;
  }
  return face > 0 ? 5 : 4;
}

/**
 * 计算双箱子和告示牌的完整布局
 * @returns { left, right, sign }
 */
export function getLayout(start: [number, number, number], direction: number, mainAxis: number, yOffset: number, face: number) {
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

/** 确保对应位置存在双箱子（根据 direction 选择沿 x 或 z 轴扩展） */
export function ensureDoubleChest(dimension: Dimension, pos: { x: number; y: number; z: number }, cardinal: string, direction: number) {
  const base = getBase(direction);
  for (const d of [0, 1]) {
    const p = {
      x: pos.x + (base[0] !== 0 ? d * base[0] : 0),
      y: pos.y,
      z: pos.z + (base[1] !== 0 ? d * base[1] : 0),
    };
    const block = dimension.getBlock(p);
    if (!block || block.typeId !== 'minecraft:chest') {
      dimension.setBlockPermutation(p, BlockPermutation.resolve('chest', { 'minecraft:cardinal_direction': cardinal }));
    }
  }
}

/** 放置墙上告示牌并设置文字 */
export function placeSign(dimension: Dimension, pos: { x: number; y: number; z: number }, facing: number, text: string) {
  dimension.setBlockPermutation(
    pos,
    BlockPermutation.resolve('pale_oak_wall_sign', { 'facing_direction': facing })
  );
  try {
    const block = dimension.getBlock(pos);
    const sign = block?.getComponent(BlockComponentTypes.Sign) as any;
    if (sign) sign.setText(text);
  } catch { }
}

/** 获取 Asia/Shanghai 时区的日期时间字符串 */
export function getShanghaiTime() {
  const now = new Date();
  const offset = 8 * 60; // UTC+8 in minutes
  const local = new Date(now.getTime() + offset * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,
  };
}

/** 系统消息回调（由 DogeChat 注册，用于将 Msg 消息写入系统频道） */
let _systemMsgHandler: ((player: Player, text: string) => void) | null = null;
export function registerSystemMsgHandler(handler: (player: Player, text: string) => void) {
  _systemMsgHandler = handler;
}

export const Msg = {
  info:(msg: string, player: Player) => {
    player.sendMessage(`§f[*] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
   error:(msg: string, player: Player) => {
    player.sendMessage(`§c[x] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  success:(msg: string, player: Player) => {
    player.sendMessage(`§a[√] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  warning:(msg: string, player: Player) => {
    player.sendMessage(`§e[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  tips:(msg: string, player: Player) => {   
    player.sendMessage(`§7[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  }
}

export function ListFormInfo(str: string[]) {
  if (str.length === 0) return '§7请选择操作：';
  let lines = [];
  lines.push(`[*] ${str[0]}`);
  if (str.length > 1) {
    str.shift();
    for (let line of str) {
    lines.push(`${line}`)
    }
  }
  lines.push('');
  lines.push(`§7请选择操作：`);
  return lines.join("\n");
};
