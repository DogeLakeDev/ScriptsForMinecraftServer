import { data } from "../data/Permission";
export class Permission {
    /**
     * @param player
     * @returns 权限等级
     */
    static getPermission(player) {
        if (data[player.name] !== undefined) {
            return data[player.name];
        }
        if (player.isOp()) {
            return this.OP;
        }
        return this.Any;
    }
    /**
     * TODO: 因为脚本无法保存数据，tag/动态属性存储不稳定，这个函数没有作用
     */
    static setPermission(player, permission) {
    }
}
Permission.Guest = -1; // 脚本指定的无权限访客
Permission.Any = 0; // 普通玩家
Permission.OP = 1; // 服务器原生 OP
Permission.ScriptAdmin = 2; // 脚本指定的 OP
//# sourceMappingURL=Permission.js.map