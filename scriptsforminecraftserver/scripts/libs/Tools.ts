import { Player, world } from "@minecraft/server";

export function pointInArea_2D(x: number, z: number, areaStart_x: number, areaStart_z: number, areaEnd_x: number, areaEnd_z: number): boolean {
    if (areaStart_x < areaEnd_x) {
        if (x < areaStart_x || areaEnd_x < x) {
            return false;
        }
    } else {
        if (x < areaEnd_x || areaStart_x < x) {
            return false;
        }
    }
    if (areaStart_z < areaEnd_z) {
        if (z < areaStart_z || areaEnd_z < z) {
            return false;
        }
    } else {
        if (z < areaEnd_z || areaStart_z < z) {
            return false;
        }
    }
    return true;
}

export function pointInArea_3D(
    x: number, y: number, z: number,
    areaStart_x: number, areaStart_y: number, areaStart_z: number,
    areaEnd_x: number, areaEnd_y: number, areaEnd_z: number
): boolean {
    if (areaStart_x < areaEnd_x) {
        if (x < areaStart_x || areaEnd_x < x) return false;
    } else {
        if (x < areaEnd_x || areaStart_x < x) return false;
    }
    if (areaStart_y < areaEnd_y) {
        if (y < areaStart_y || areaEnd_y < y) return false;
    } else {
        if (y < areaEnd_y || areaStart_y < y) return false;
    }
    if (areaStart_z < areaEnd_z) {
        if (z < areaStart_z || areaEnd_z < z) return false;
    } else {
        if (z < areaEnd_z || areaStart_z < z) return false;
    }
    return true;
}

export function playerCMDName(name: string): string {
    if (name.indexOf(' ') !== -1) {
        return '"' + name + '"';
    }
    return name;
}

export function logger(str: string): void {
    for (const pl of world.getPlayers()) {
        pl.sendMessage({ rawtext: [{ text: `${str}` }] });
    }
}

export function getRandomInteger(min: number = 0, max: number = 1): number {
    return min + Math.floor(Math.random() * (max + 1));
}
