/**
 * msg.ts — 玩家频道与系统消息统一门面
 */

import { Player } from "@minecraft/server";

let _systemMsgHandler: ((player: Player, text: string) => void) | null = null;

/**
 * 注册系统频道消息转发回调（例如同步转发至 QQ 桥等外部通道）。
 * 每次通过 `Msg.*` 发送消息时均会同步触发此回调；传入空实现或 `null` 可关闭转发。
 *
 * @param handler 接收目标玩家与消息文本的转发回调函数。
 */
export function registerSystemMsgHandler(handler: (player: Player, text: string) => void): void {
  _systemMsgHandler = handler;
}

/**
 * 玩家频道消息门面。统一前缀与文本色彩规范，**禁止**业务模块直接调用原生的 `player.sendMessage()`。
 *
 * 样式对应规范：
 * - `info` → `§f[*]`（常规信息）
 * - `success` → `§a[√]`（操作成功）
 * - `error` → `§c[x]`（错误警示）
 * - `warning` → `§e[!]`（重要警告）
 * - `tips` → `§7[!]`（补充提示 / 次要说明）
 */
export const Msg = {
  /**
   * 发送常规提示信息（前缀 `§f[*]`）。
   *
   * @param msg 消息正文文本。
   * @param player 目标玩家对象。
   */
  info: (msg: string, player: Player) => {
    player.sendMessage(`§f[*] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },

  /**
   * 发送操作失败或错误警示信息（前缀 `§c[x]`）。
   *
   * @param msg 消息正文文本。
   * @param player 目标玩家对象。
   */
  error: (msg: string, player: Player) => {
    player.sendMessage(`§c[x] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },

  /**
   * 发送操作成功提示信息（前缀 `§a[√]`）。
   *
   * @param msg 消息正文文本。
   * @param player 目标玩家对象。
   */
  success: (msg: string, player: Player) => {
    player.sendMessage(`§a[√] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },

  /**
   * 发送警告提示信息（前缀 `§e[!]`）。
   *
   * @param msg 消息正文文本。
   * @param player 目标玩家对象。
   */
  warning: (msg: string, player: Player) => {
    player.sendMessage(`§e[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },

  /**
   * 发送次要说明或弱提示信息（前缀 `§7[!]`）。
   *
   * @param msg 消息正文文本。
   * @param player 目标玩家对象。
   */
  tips: (msg: string, player: Player) => {
    player.sendMessage(`§7[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
};

