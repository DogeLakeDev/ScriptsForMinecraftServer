/**
 * Holoprint Texture Atlas — 虚拟纹理图集 UV 映射生成器
 *
 * 为 Minecraft 方块 palette 生成虚拟纹理图集映射。
 * 由于服务器端无法访问实际的材质纹理文件，采用简化的虚拟图集方案：
 * 每个方块类型在虚拟图集中分配一个 16×16 像素的 tile 区域。
 */

const ATLAS_TILE_SIZE = 16;
const ATLAS_WIDTH = 256;
const TILES_PER_ROW = ATLAS_WIDTH / ATLAS_TILE_SIZE;

/**
 * 为给定的 block palette 生成虚拟纹理图集
 *
 * @param {Array} palette - block palette 数组，每项 {name, states}
 * @returns {Array} 纹理图集条目数组，每项包含:
 *   {blockName, states, atlasX, atlasY, atlasWidth, atlasHeight}
 */
function generateTextureAtlas(palette) {
  if (!Array.isArray(palette) || palette.length === 0) {
    return [];
  }

  // 去重：同一方块类型只占一个 tile
  const seen = new Map();
  const uniqueBlocks = [];

  for (const entry of palette) {
    const key = entry.name + '|' + JSON.stringify(entry.states || {});
    if (!seen.has(key)) {
      seen.set(key, true);
      uniqueBlocks.push(entry);
    }
  }

  return uniqueBlocks.map((entry, index) => {
    const tileIndex = index;
    const atlasX = (tileIndex % TILES_PER_ROW) * ATLAS_TILE_SIZE;
    const atlasY = Math.floor(tileIndex / TILES_PER_ROW) * ATLAS_TILE_SIZE;

    return {
      blockName: entry.name,
      states: entry.states || {},
      atlasX,
      atlasY,
      atlasWidth: ATLAS_TILE_SIZE,
      atlasHeight: ATLAS_TILE_SIZE,
    };
  });
}

/**
 * 获取指定方块在某一面的 UV 坐标
 *
 * @param {Object|string} blockRef - 方块名称字符串或图集条目对象
 * @param {Array} textureAtlas - 纹理图集条目数组
 * @param {string} face - 面方向 (north/south/east/west/up/down)
 * @returns {{ uv: [number, number], uv_size: [number, number] }}
 */
function getUVForBlock(blockRef, textureAtlas, face) {
  if (!Array.isArray(textureAtlas) || textureAtlas.length === 0) {
    return { uv: [0, 0], uv_size: [16, 16] };
  }

  const entry = typeof blockRef === 'string'
    ? textureAtlas.find(e => e.blockName === blockRef)
    : blockRef;

  if (!entry) {
    // 未找到时返回默认 UV
    return { uv: [0, 0], uv_size: [16, 16] };
  }

  return {
    uv: [entry.atlasX, entry.atlasY],
    uv_size: [entry.atlasWidth, entry.atlasHeight],
  };
}

module.exports = { generateTextureAtlas, getUVForBlock };
