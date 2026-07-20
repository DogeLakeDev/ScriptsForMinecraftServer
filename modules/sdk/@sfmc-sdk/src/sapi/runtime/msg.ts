import { Player } from "@minecraft/server";

let _systemMsgHandler: ((player: Player, text: string) => void) | null = null;

export function registerSystemMsgHandler(handler: (player: Player, text: string) => void): void {
  _systemMsgHandler = handler;
}

export const Msg = {
  info: (msg: string, player: Player) => {
    player.sendMessage(`§f[*] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  error: (msg: string, player: Player) => {
    player.sendMessage(`§c[x] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  success: (msg: string, player: Player) => {
    player.sendMessage(`§a[√] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  warning: (msg: string, player: Player) => {
    player.sendMessage(`§e[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  tips: (msg: string, player: Player) => {
    player.sendMessage(`§7[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
};