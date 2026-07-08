/** 颜色预设列表 */
export const COLOR_PRESETS = [
    { name: "白色", value: "255 255 255", hex: "#FFFFFF" },
    { name: "红色", value: "255 85 85", hex: "#FF5555" },
    { name: "橙色", value: "255 170 0", hex: "#FFAA00" },
    { name: "黄色", value: "255 255 85", hex: "#FFFF55" },
    { name: "绿色", value: "85 255 85", hex: "#55FF55" },
    { name: "青色", value: "85 255 255", hex: "#55FFFF" },
    { name: "蓝色", value: "85 85 255", hex: "#5555FF" },
    { name: "紫色", value: "170 0 170", hex: "#AA00AA" },
    { name: "粉色", value: "255 85 255", hex: "#FF55FF" },
    { name: "灰色", value: "170 170 170", hex: "#AAAAAA" },
];
/** 默认投影设置 */
export const DEFAULT_HOLO_SETTINGS = {
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotation: 0,
    opacity: 1.0,
    layer: 0,
    visible: true,
    spawnAnimation: false,
    blockInspect: false,
    overlayTint: "",
    overlayTintOpacity: 0,
    textureOutlineWidth: 0,
    textureOutlineColor: "",
    textureOutlineOpacity: 0,
    layerMode: "all",
};
// ---- 工具函数 ----
/** 将数据库行对象转为 ProjectionData */
export function rowToProjection(row) {
    return {
        id: row.id,
        name: row.name,
        author: row.author,
        description: row.description,
        ownerId: row.owner_id,
        isPublic: !!row.is_public,
        visibility: row.visibility,
        settings: {
            scale: row.scale,
            offsetX: row.offset_x,
            offsetY: row.offset_y,
            offsetZ: row.offset_z,
            rotation: row.rotation,
            opacity: row.opacity,
            layer: row.layer,
            visible: !!row.visible,
            spawnAnimation: !!row.spawn_animation,
            blockInspect: !!row.block_inspect,
            overlayTint: row.overlay_tint,
            overlayTintOpacity: row.overlay_tint_opacity,
            textureOutlineWidth: row.texture_outline_width,
            textureOutlineColor: row.texture_outline_color,
            textureOutlineOpacity: row.texture_outline_opacity,
            layerMode: row.layer_mode,
        },
        dbVersion: row.db_version,
        geometryFile: row.geometry_file,
        blockCount: row.block_count,
        sizeX: row.size_x,
        sizeY: row.size_y,
        sizeZ: row.size_z,
        materials: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=HoloPrint.js.map