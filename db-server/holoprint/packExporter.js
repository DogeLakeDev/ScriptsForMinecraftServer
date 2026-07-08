/**
 * Holoprint Pack Exporter — Minecraft 资源包生成与导出
 *
 * 将 blockGeoMaker 生成的 cube primitive 数组打包为
 * Minecraft Bedrock 资源包 (几何体 JSON、渲染控制器、manifest)。
 *
 * 几何体格式遵循 format_version 1.16.0 的
 * "minecraft:geometry" 规范。
 */

const fs = require('fs');
const path = require('path');

// ============================================================
//  工具函数
// ============================================================

/**
 * 基于投影 ID 生成确定性 UUID v3-like 字符串
 *
 * @param {string} projectionId - 投影 ID
 * @param {string} namespace - 命名空间
 * @returns {string} UUID 字符串
 */
function uuidFromId(projectionId, namespace) {
  // 使用简单哈希生成确定性 UUID
  const seed = namespace + ':' + projectionId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }

  const hex = (Math.abs(hash) >>> 0).toString(16).padStart(8, '0');
  const now = Date.now().toString(16).slice(-8);

  return (
    hex.slice(0, 8) + '-' +
    hex.slice(0, 4) + '-' +
    '4' + hex.slice(1, 4) + '-' +
    '8' + hex.slice(2, 5) + '-' +
    now.slice(0, 12)
  );
}

/**
 * 计算结构在世界坐标下的 AABB，用于 visible_bounds
 */
function calculateBounds(cubes) {
  if (!Array.isArray(cubes) || cubes.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const cube of cubes) {
    const [ox, oy, oz] = cube.origin;
    const [sx, sy, sz] = cube.size;
    minX = Math.min(minX, ox);
    minY = Math.min(minY, oy);
    minZ = Math.min(minZ, oz);
    maxX = Math.max(maxX, ox + sx);
    maxY = Math.max(maxY, oy + sy);
    maxZ = Math.max(maxZ, oz + sz);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

// ============================================================
//  生成函数
// ============================================================

/**
 * 生成完整的 Minecraft Bedrock 几何体 JSON
 *
 * @param {string} projectionId - 投影的唯一标识符
 * @param {Array}  blockGeometries - blockGeoMaker 输出的 cube 数组
 * @param {Object} structureSize - {x, y, z} 结构尺寸
 * @param {number} textureWidth  - 纹理图集宽度 (默认 256)
 * @param {number} textureHeight - 纹理图集高度 (默认 256)
 * @returns {Object} 完整的几何体 JSON 对象
 */
function generateStructureGeometry(
  projectionId,
  blockGeometries,
  structureSize,
  textureWidth = 256,
  textureHeight = 256,
) {
  const bounds = calculateBounds(blockGeometries);
  const bw = Math.max(
    (bounds.max[0] - bounds.min[0]) / 16,
    structureSize?.x || 1,
    1,
  );
  const bh = Math.max(
    (bounds.max[1] - bounds.min[1]) / 16,
    structureSize?.y || 1,
    1,
  );
  const bd = Math.max(
    (bounds.max[2] - bounds.min[2]) / 16,
    structureSize?.z || 1,
    1,
  );

  const visibleWidth = Math.max(bw, bd) + 2;
  const visibleHeight = bh + 2;

  // 中心偏移：使结构居中在实体位置
  const centerOffset = [
    -(bounds.min[0] + bounds.max[0]) / 2 / 16,
    -(bounds.min[1] + bounds.max[1]) / 2 / 16,
    -(bounds.min[2] + bounds.max[2]) / 2 / 16,
  ];

  // 打包 cube 数组（将 uv 对象转换为标准格式）
  const cubes = blockGeometries.map((cube) => ({
    origin: [cube.origin[0], cube.origin[1], cube.origin[2]],
    size: [cube.size[0], cube.size[1], cube.size[2]],
    uv: cube.uv,
  }));

  return {
    format_version: '1.16.0',
    'minecraft:geometry': [
      {
        description: {
          identifier: `geometry.holo.${projectionId}`,
          texture_width: textureWidth,
          texture_height: textureHeight,
          visible_bounds_width: visibleWidth,
          visible_bounds_height: visibleHeight,
          visible_bounds_offset: centerOffset,
        },
        bones: [
          {
            name: 'body',
            pivot: [0, 0, 0],
            cubes,
          },
        ],
      },
    ],
  };
}

/**
 * 生成渲染控制器 JSON
 *
 * 支持:
 *   - 面透明度 (alpha 测试)
 *   - 叠加色调颜色
 *   - 支持 alpha 的材质
 *
 * @param {string} projectionId - 投影的唯一标识符
 * @returns {Object} 渲染控制器 JSON 对象
 */
function generateRenderController(projectionId) {
  return {
    format_version: '1.17.0',
    render_controllers: {
      [`controller.render.holo.${projectionId}`]: {
        geometry: `Geometry.holo.${projectionId}`,
        materials: [
          { '*': 'entity_alphatest' },
        ],
        textures: [`texture.holo.${projectionId}`],
        // 允许通过 Molang 动态控制透明度和色调
        color: {
          r: 'math.min(1.0, query.overlay_tint.r + query.overlay_tint.r * 0.5)',
          g: 'math.min(1.0, query.overlay_tint.g + query.overlay_tint.g * 0.5)',
          b: 'math.min(1.0, query.overlay_tint.b + query.overlay_tint.b * 0.5)',
          a: 'query.overlay_alpha',
        },
      },
    },
  };
}

/**
 * 生成资源包 manifest JSON
 *
 * @param {number} packVersion - 包版本号
 * @param {string} projectionId - 投影 ID (用于生成确定性 UUID)
 * @returns {Object} manifest JSON 对象
 */
function generateManifest(packVersion = 1, projectionId = 'default') {
  return {
    format_version: 2,
    header: {
      name: '§dHoloprint Projection Pack',
      description: `Auto-generated hologram resource pack for Holoprint-SFMC (v${packVersion})`,
      uuid: uuidFromId(projectionId, 'header'),
      version: [1, 0, packVersion],
      min_engine_version: [1, 19, 70],
    },
    modules: [
      {
        type: 'resources',
        uuid: uuidFromId(projectionId, 'module'),
        version: [1, 0, packVersion],
      },
    ],
  };
}

/**
 * 将生成的所有资源包文件写入磁盘
 *
 * @param {string} projectionId - 投影 ID
 * @param {Object} geometry - generateStructureGeometry 的返回结果
 * @param {Object} renderController - generateRenderController 的返回结果
 * @param {Object} manifest - generateManifest 的返回结果
 * @param {string} outputDir - 输出目录路径
 * @returns {Object} 写入的文件路径映射
 */
function exportPack(projectionId, geometry, renderController, manifest, outputDir) {
  const dirs = {
    geo: path.join(outputDir, 'geometry'),
    rc: path.join(outputDir, 'render_controllers'),
    root: outputDir,
  };

  // 确保目录存在
  for (const dir of Object.values(dirs)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const files = {
    geometry: path.join(dirs.geo, `holo_${projectionId}.json`),
    renderController: path.join(dirs.rc, `holo_${projectionId}.json`),
    manifest: path.join(dirs.root, 'manifest.json'),
  };

  // 写入文件
  fs.writeFileSync(files.geometry, JSON.stringify(geometry, null, 2), 'utf-8');
  fs.writeFileSync(files.renderController, JSON.stringify(renderController, null, 2), 'utf-8');
  fs.writeFileSync(files.manifest, JSON.stringify(manifest, null, 2), 'utf-8');

  return files;
}

module.exports = {
  generateStructureGeometry,
  generateRenderController,
  generateManifest,
  exportPack,
};
