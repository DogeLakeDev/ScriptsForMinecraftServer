import { Player } from "@minecraft/server";
import { data } from "../data/Permission";

export class Permission {
    static Guest = -1;       // 脚本指定的无权限访客
    static Any = 0;          // 普通玩家
    static OP = 1;           // 服务器原生 OP
    static ScriptAdmin = 2;  // 脚本指定的 OP

    static getPermission(player: Player): number {
        if (data[player.name] !== undefined) {
            return data[player.name];
        } else {
            if ((player as any).isOp()) {
                return this.OP;
            } else {
                return this.Any;
            }
        }
    }

    /**
     * TODO: 因为脚本无法保存数据，tag/动态属性存储不稳定，这个函数没有作用
     */
    static setPermission(player: Player, permission: number): void {
        // no-op
    }
}
