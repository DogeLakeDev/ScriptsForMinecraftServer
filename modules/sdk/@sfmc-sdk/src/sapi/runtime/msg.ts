import { Player } from "@minecraft/server";

let _systemMsgHandler: ((player: Player, text: string) => void) | null = null;

/**
 * 注册系统频道转发回调（QQ 桥等）。
 * 每次 `Msg.*` 发消息时同步调用；传空实现可关闭转发。
 */
export function registerSystemMsgHandler(handler: (player: Player, text: string) => void): void {
  _systemMsgHandler = handler;
}

/**
 * 玩家频道消息门面。统一前缀与样式，**禁止**模块直接 `player.sendMessage()`。
 *
 * - `info` → `§f[*]`
 * - `success` → `§a[√]`
 * - `error` → `§c[x]`
 * - `warning` → `§e[!]`
 * - `tips` → `§7[!]`
 */
export const Msg = {
  /** 普通提示 */
  info: (msg: string, player: Player) => {
    player.sendMessage(`§f[*] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  /** 错误提示 */
  error: (msg: string, player: Player) => {
    player.sendMessage(`§c[x] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  /** 成功提示 */
  success: (msg: string, player: Player) => {
    player.sendMessage(`§a[√] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  /** 警告提示 */
  warning: (msg: string, player: Player) => {
    player.sendMessage(`§e[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  /** 弱提示 / 补充说明 */
  tips: (msg: string, player: Player) => {
    player.sendMessage(`§7[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
};
