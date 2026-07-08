/**
 * Holoprint Block Geometry Maker — Minecraft 方块几何生成器
 *
 * 将解析后的 .mcstructure 数据 (block palette + positions) 转换为
 * Minecraft Bedrock 几何体 JSON 所需的 cube primitive 数组。
 *
 * 支持的方块形状:
 *  - 完整方块 (full block)
 *  - 台阶 (slab)
 *  - 楼梯 (stairs)
 *  - 玻璃板 (glass pane)
 *  - 栅栏 (fence)
 *  - 墙 (wall)
 *  - 门 (door)
 *  - 火把 (torch)
 *  - 梯子 (ladder)
 */

const { getUVForBlock } = require('./textureAtlas');

// ============================================================
//  内部工具函数
// ============================================================

/**
 * 为一个带有 UV 贴图的 cube primitive 生成 "每个面" 的 UV 数据
 *
 * @param {string} blockName - 方块名称
 * @param {Array}  textureAtlas - 纹理图集
 * @param {number[]} size - 立方体尺寸 [w, h, d]
 * @returns {Object} 每个面的 UV 映射
 */
function buildFaceUV(blockName, textureAtlas, size) {
  const [w, h, d] = size;
  const baseUV = getUVForBlock(blockName, textureAtlas);
  const [u, v] = baseUV.uv;
  const tileW = baseUV.uv_size[0];
  const tileH = baseUV.uv_size[1];

  return {
    north: { uv: [u, v], uv_size: [w, h] },
    south: { uv: [u, v], uv_size: [w, h] },
    east:  { uv: [u, v], uv_size: [d, h] },
    west:  { uv: [u, v], uv_size: [d, h] },
    up:    { uv: [u, v], uv_size: [w, d] },
    down:  { uv: [u, v], uv_size: [w, d] },
  };
}

/**
 * 创建一个 cube primitive
 *
 * @param {string}   blockName - 方块名称
 * @param {number[]} origin - 原点 [x, y, z] (0-16 方块内坐标)
 * @param {number[]} size   - 尺寸 [w, h, d]
 * @param {Array}    textureAtlas - 纹理图集
 * @returns {Object} cube primitive
 */
function makeCube(blockName, origin, size, textureAtlas) {
  return {
    origin: [origin[0], origin[1], origin[2]],
    size: [size[0], size[1], size[2]],
    uv: buildFaceUV(blockName, textureAtlas, size),
  };
}

// ============================================================
//  方块形状生成器
// ============================================================

/**
 * 完整方块: 16×16×16
 */
function generateFullBlock(blockName, blockStates, textureAtlas) {
  return [makeCube(blockName, [0, 0, 0], [16, 16, 16], textureAtlas)];
}

/**
 * 台阶 (Slab): 半砖
 *
 * 状态:
 *   - minecraft:vertical_half: "top" | "bottom"
 */
function generateSlab(blockName, blockStates, textureAtlas) {
  const half = blockStates['minecraft:vertical_half'];
  const isTop = half === 'top';
  const y = isTop ? 8 : 0;

  return [makeCube(blockName, [0, y, 0], [16, 8, 16], textureAtlas)];
}

/**
 * 楼梯 (Stairs): 2 个 cube 组成的阶梯形状
 *
 * 状态:
 *   - facing_direction: 0=west, 1=east, 2=north, 3=south
 *   - upside_down_bit: true/false
 */
function generateStairs(blockName, blockStates, textureAtlas) {
  const facing = blockStates.facing_direction ?? 2;
  const upsideDown = blockStates.upside_down_bit === true || blockStates.upside_down_bit === 1;

  const slabY = upsideDown ? 8 : 0;
  const stepY = upsideDown ? 0 : 8;

  let stepOrigin, stepSize;

  switch (facing) {
    case 0: // west — 台阶在西侧 (负 X 方向)
      stepOrigin = [0, stepY, 0];
      stepSize = [8, 8, 16];
      break;
    case 1: // east — 台阶在东侧 (正 X 方向)
      stepOrigin = [8, stepY, 0];
      stepSize = [8, 8, 16];
      break;
    case 2: // north — 台阶在北侧 (负 Z 方向)
      stepOrigin = [0, stepY, 0];
      stepSize = [16, 8, 8];
      break;
    case 3: // south — 台阶在南侧 (正 Z 方向)
      stepOrigin = [0, stepY, 8];
      stepSize = [16, 8, 8];
      break;
    default:
      stepOrigin = [0, stepY, 0];
      stepSize = [16, 8, 8];
  }

  return [
    makeCube(blockName, [0, slabY, 0], [16, 8, 16], textureAtlas),
    makeCube(blockName, stepOrigin, stepSize, textureAtlas),
  ];
}

/**
 * 玻璃板 (Glass Pane): 十字交叉形状
 *
 * 由两个正交的薄板交叉组成。
 */
function generateGlassPane(blockName, blockStates, textureAtlas) {
  return [
    // 南北方向面板
    makeCube(blockName, [7, 0, 0], [2, 16, 16], textureAtlas),
    // 东西方向面板
    makeCube(blockName, [0, 0, 7], [16, 16, 2], textureAtlas),
  ];
}

/**
 * 栅栏 (Fence): 中心柱 + 横梁连接件
 */
function generateFence(blockName, blockStates, textureAtlas) {
  return [
    // 中心柱 (6×16×6)
    makeCube(blockName, [5, 0, 5], [6, 16, 6], textureAtlas),
    // 南北方向横梁 (4×4×16)
    makeCube(blockName, [6, 6, 0], [4, 4, 16], textureAtlas),
    // 东西方向横梁 (16×4×4)
    makeCube(blockName, [0, 6, 6], [16, 4, 4], textureAtlas),
  ];
}

/**
 * 墙 (Wall): 中心柱 + 全高连接片
 */
function generateWall(blockName, blockStates, textureAtlas) {
  return [
    // 中心柱 (8×16×8)
    makeCube(blockName, [4, 0, 4], [8, 16, 8], textureAtlas),
    // 南北方向连接片 (4×16×16)
    makeCube(blockName, [6, 0, 0], [4, 16, 16], textureAtlas),
    // 东西方向连接片 (16×16×4)
    makeCube(blockName, [0, 0, 6], [16, 16, 4], textureAtlas),
  ];
}

/**
 * 门 (Door): 上下两半薄板
 *
 * 状态:
 *   - direction: 0=east, 1=south, 2=west, 3=north (门的朝向)
 *   - open_bit: true/false
 *   - upper_block_bit: true=上半部分, false=下半部分
 *   - door_hinge_bit: true=右铰链, false=左铰链
 *
 * 注意：门由上下两个方块组成，各渲染一半。
 */
function generateDoor(blockName, blockStates, textureAtlas) {
  const isUpper = blockStates.upper_block_bit === true || blockStates.upper_block_bit === 1;
  const y = isUpper ? 16 : 0;

  // 门的厚度约 3 像素
  return [makeCube(blockName, [0, y, 6.5], [16, 16, 3], textureAtlas)];
}

/**
 * 火把 (Torch): 细柱 + 顶部
 */
function generateTorch(blockName, blockStates, textureAtlas) {
  return [
    // 柱体 (4×10×4)
    makeCube(blockName, [6, 0, 6], [4, 10, 4], textureAtlas),
    // 顶部 (8×6×8)
    makeCube(blockName, [4, 10, 4], [8, 6, 8], textureAtlas),
  ];
}

/**
 * 梯子 (Ladder): 贴墙薄板
 *
 * 状态:
 *   - facing_direction: 2=north, 3=south, 0=west, 1=east
 */
function generateLadder(blockName, blockStates, textureAtlas) {
  const facing = blockStates.facing_direction ?? 2;

  let ox = 0, oz = 0;

  switch (facing) {
    case 2: // 贴在北侧 -> 面板在北面
      oz = 14;
      break;
    case 3: // 贴在南侧
      oz = 0;
      break;
    case 0: // 贴在西侧
      ox = 14;
      oz = 0;
      break;
    case 1: // 贴在东侧
      ox = 0;
      oz = 0;
      break;
    default:
      oz = 14;
  }

  return [makeCube(blockName, [ox, 0, oz], [16, 16, 2], textureAtlas)];
}

// ============================================================
//  方块形状匹配规则
// ============================================================

/**
 * 根据方块名称匹配对应的形状生成器
 *
 * 规则引擎：按模式匹配方块名称，未匹配的类型视为完整方块。
 *
 * @param {string} name - 方块名称 (如 "minecraft:oak_slab")
 * @returns {Function|null} 形状生成器函数
 */
function matchShapeHandler(name) {
  const lower = name.toLowerCase();

  // 必须优先检测的特殊类型
  // 玻璃板
  if (lower === 'minecraft:glass_pane' || lower.endsWith('_glass_pane') || lower.endsWith(':glass_pane')) {
    return generateGlassPane;
  }

  // 铁栏杆 (thin flat barrier, 类似玻璃板形状)
  if (lower === 'minecraft:iron_bars') {
    return generateGlassPane;
  }

  // 火把
  if (lower === 'minecraft:torch') {
    return generateTorch;
  }

  // 梯子
  if (lower === 'minecraft:ladder') {
    return generateLadder;
  }

  // 台阶 (slab)
  if (lower.endsWith('_slab') || lower.endsWith(':slab') || lower === 'minecraft:stone_slab') {
    return generateSlab;
  }

  // 楼梯 (stairs)
  if (lower.endsWith('_stairs') || lower.endsWith(':stairs')) {
    return generateStairs;
  }

  // 栅栏 (fence)
  if (lower.endsWith('_fence') || lower.endsWith(':fence')) {
    return generateFence;
  }

  // 墙 (wall)
  if (lower.endsWith('_wall') || lower.endsWith(':wall')) {
    return generateWall;
  }

  // 门 (door)
  if (lower.endsWith('_door') || lower.endsWith(':door')) {
    return generateDoor;
  }

  // 默认：完整方块
  return null;
}

// ============================================================
//  导出函数
// ============================================================

/**
 * 生成指定方块的几何体 cube primitives
 *
 * @param {string} blockName - 方块名称
 * @param {Object} blockStates - 方块状态
 * @param {Array}  textureAtlas - 纹理图集
 * @returns {Array} cube primitive 数组
 */
function generateBlockGeometry(blockName, blockStates, textureAtlas) {
  const handler = matchShapeHandler(blockName);
  if (handler) {
    return handler(blockName, blockStates || {}, textureAtlas);
  }
  return generateFullBlock(blockName, blockStates || {}, textureAtlas);
}

/**
 * 为整个结构生成所有方块的几何体
 *
 * 将每个方块在方块内部坐标 (0-16) 下的 cube，
 * 转换为结构世界坐标 (以实体位置为中心)。
 *
 * @param {Array} blocks  - 方块位置数组 [{x, y, z, palette_index}, ...]
 * @param {Array} palette - 方块 palette [{name, states}, ...]
 * @param {Array} textureAtlas - 纹理图集
 * @returns {Array} 世界坐标系下的 cube primitive 数组
 */
function generateFullStructureGeometry(blocks, palette, textureAtlas) {
  if (!Array.isArray(blocks) || !Array.isArray(palette)) {
    return [];
  }

  const allCubes = [];

  for (const block of blocks) {
    const paletteEntry = palette[block.palette_index];
    if (!paletteEntry) continue;

    const blockName = paletteEntry.name || 'minecraft:air';
    if (blockName === 'minecraft:air') continue;

    const blockCubes = generateBlockGeometry(
      blockName,
      paletteEntry.states || {},
      textureAtlas,
    );

    // 将方块局部坐标偏移到结构世界坐标
    // bx*16 - 8: 使方块中心位于结构坐标的整数格点上
    for (const cube of blockCubes) {
      allCubes.push({
        origin: [
          cube.origin[0] + block.x * 16 - 8,
          cube.origin[1] + block.y * 16 - 8,
          cube.origin[2] + block.z * 16 - 8,
        ],
        size: cube.size,
        uv: cube.uv,
      });
    }
  }

  return allCubes;
}

module.exports = {
  generateBlockGeometry,
  generateFullStructureGeometry,

  // 暴露形状生成器以便扩展
  generateFullBlock,
  generateSlab,
  generateStairs,
  generateGlassPane,
  generateFence,
  generateWall,
  generateDoor,
  generateTorch,
  generateLadder,
};
