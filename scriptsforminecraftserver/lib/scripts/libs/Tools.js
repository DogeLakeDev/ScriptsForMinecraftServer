import { world, BlockPermutation, BlockComponentTypes } from "@minecraft/server";
// 判断坐标是否在某区域内 (2D, 包含边界)
export function pointInArea_2D(x, z, areaStart_x, areaStart_z, areaEnd_x, areaEnd_z) {
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
export function pointInArea_3D(x, y, z, areaStart_x, areaStart_y, areaStart_z, areaEnd_x, areaEnd_y, areaEnd_z) {
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
export function playerCMDName(name) {
    if (name.indexOf(' ') !== -1) {
        return '"' + name + '"';
    }
    return name;
}
export function logger(str) {
    for (let player of world.getPlayers()) {
        player.sendMessage({ rawtext: [{ "text": `${str}` }] });
    }
}
/**
 * 获取随机整数 两边都是闭区间
 */
export function getRandomInteger(min = 0, max = 1) {
    return min + Math.floor(Math.random() * (max + 1));
}
// ============================================
//  双箱子布局工具
// ============================================
/** 根据 direction 获取增长方向基向量 */
export function getBase(direction) {
    switch (direction) {
        case 1: return [1, 0];
        case -1: return [-1, 0];
        case 2: return [0, 1];
        case -2: return [0, -1];
        default: return [1, 0];
    }
}
/** 获取箱子面朝方向（与 Clean 一致） */
export function getChestCardinal(direction, face) {
    if (direction === -1 || direction === 1) {
        return face > 0 ? 'south' : 'north';
    }
    return face > 0 ? 'east' : 'west';
}
/** 获取墙上告示牌的面朝方向（与 Clean 一致） */
export function getSignFacing(direction, face) {
    if (direction === -1 || direction === 1) {
        return face > 0 ? 3 : 2;
    }
    return face > 0 ? 5 : 4;
}
/**
 * 计算双箱子和告示牌的完整布局
 * @returns { left, right, sign }
 */
export function getLayout(start, direction, mainAxis, yOffset, face) {
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
export function ensureDoubleChest(dimension, pos, cardinal, direction) {
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
export function placeSign(dimension, pos, facing, text) {
    dimension.setBlockPermutation(pos, BlockPermutation.resolve('pale_oak_wall_sign', { 'facing_direction': facing }));
    try {
        const block = dimension.getBlock(pos);
        const sign = block === null || block === void 0 ? void 0 : block.getComponent(BlockComponentTypes.Sign);
        if (sign)
            sign.setText(text);
    }
    catch (_a) { }
}
/** 获取 Asia/Shanghai 时区的日期时间字符串 */
export function getShanghaiTime() {
    const now = new Date();
    const offset = 8 * 60; // UTC+8 in minutes
    const local = new Date(now.getTime() + offset * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
        time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,
    };
}
/** 系统消息回调（由 DogeChat 注册，用于将 Msg 消息写入系统频道） */
let _systemMsgHandler = null;
export function registerSystemMsgHandler(handler) {
    _systemMsgHandler = handler;
}
export const Msg = {
    info: (msg, player) => {
        player.sendMessage(`§f[*] ${msg}`);
        _systemMsgHandler === null || _systemMsgHandler === void 0 ? void 0 : _systemMsgHandler(player, msg);
    },
    error: (msg, player) => {
        player.sendMessage(`§c[x] ${msg}`);
        _systemMsgHandler === null || _systemMsgHandler === void 0 ? void 0 : _systemMsgHandler(player, msg);
    },
    success: (msg, player) => {
        player.sendMessage(`§a[√] ${msg}`);
        _systemMsgHandler === null || _systemMsgHandler === void 0 ? void 0 : _systemMsgHandler(player, msg);
    },
    warning: (msg, player) => {
        player.sendMessage(`§e[!] ${msg}`);
        _systemMsgHandler === null || _systemMsgHandler === void 0 ? void 0 : _systemMsgHandler(player, msg);
    },
    tips: (msg, player) => {
        player.sendMessage(`§7[!] ${msg}`);
        _systemMsgHandler === null || _systemMsgHandler === void 0 ? void 0 : _systemMsgHandler(player, msg);
    }
};
export function ListFormInfo(str) {
    if (str.length === 0)
        return '§7请选择操作：';
    let lines = [];
    lines.push(`[*] ${str[0]}`);
    if (str.length > 1) {
        str.shift();
        for (let line of str) {
            lines.push(`${line}`);
        }
    }
    lines.push('');
    lines.push(`§7请选择操作：`);
    return lines.join("\n");
}
;
//# sourceMappingURL=Tools.js.map