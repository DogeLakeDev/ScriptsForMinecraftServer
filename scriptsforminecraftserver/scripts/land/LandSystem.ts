/* ---------------------------------------- *\
 *  土地插件 — 入口 / 命令注册
\* ---------------------------------------- */

import { Player, system } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { LandCore } from "./LandCore";
import { LandGUI } from "../gui/LandGUI";
import { LandTax } from "./LandTax";
import { Msg } from "../libs/Tools";
import { Database } from "./LandDatabase";
import { LandEvents } from "./LandEvents";
import { debug } from "../libs/DebugLog";

export class LandSystem {
  private static refreshRunId: number | undefined;
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  static registerCommandsAndPermissions() {
    debug.i("LAND", "registerCommandsAndPermissions");
    Permission.register("land.use", Permission.Any);

    Command.register(
      "land",
      "land.use",
      (player: Player | undefined) => {
        if (!player) return "§c该指令只能由玩家执行。";
        LandGUI.showMainMenu(player);
      },
      "土地管理",
      "land"
    );

    Command.register(
      "land here",
      "land.use",
      (player: Player | undefined) => {
        if (!player) return "§c该指令只能由玩家执行。";
        const pos = {
          x: Math.floor(player.location.x),
          y: Math.floor(player.location.y),
          z: Math.floor(player.location.z),
        };
        const dimid =
          player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
        const land = LandCore.getLandByPos(pos, dimid);
        if (!land) return "当前位置不在任何土地内。";
        return `土地：${land.nickname || land.id}，所有者：${land.ownerName}，版本：${land.version || 1}`;
      },
      "查询当前土地",
      "land"
    );

    Command.register(
      "land cancel",
      "land.use",
      (player: Player | undefined) => {
        if (!player) return "§c该指令只能由玩家执行。";
        if (LandCore.clearSession(player.id)) Msg.success("土地申请已取消。", player);
        else Msg.error("你没有正在进行的土地申请。", player);
      },
      "取消土地申请",
      "land"
    );

    Command.register(
      "pos1",
      "land.use",
      (player: Player | undefined) => {
        if (!player) return "§c该指令只能由玩家执行";
        handlePosCommand(player, 1);
      },
      "设置土地第一点",
      "land"
    );

    Command.register(
      "pos2",
      "land.use",
      (player: Player | undefined) => {
        if (!player) return "§c该指令只能由玩家执行";
        handlePosCommand(player, 2);
      },
      "设置土地第二点",
      "land"
    );
  }

  static init() {
    debug.i("LAND", "init");
    void Database.loadFromServer();
    LandTax.start();
    this.refreshRunId = system.runInterval(() => {
      LandCore.clearExpiredSessions();
      void Database.refresh();
    }, 20 * 60);
  }

  static cleanup(): void {
    debug.i("LAND", "cleanup");
    LandTax.stop();
    if (this.refreshRunId !== undefined) system.clearRun(this.refreshRunId);
    this.refreshRunId = undefined;
  }
}

function handlePosCommand(player: Player, which: 1 | 2) {
  const plid = player.id;
  const pos = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;

  const session = LandCore.getSession(plid);
  if (!session) return Msg.error("你没有正在进行的土地申请。", player);
  if (session.dimensionId !== undefined && session.dimensionId !== dimid)
    return Msg.error("土地选点不能跨维度，请在同一维度重新选择。", player);
  if (session.dimensionId === undefined) LandCore.setDimension(plid, dimid);

  if (which === 1) {
    LandCore.setPos1(plid, pos);
    Msg.success(`已设置第一点 §f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  } else {
    LandCore.setPos2(plid, pos);
    Msg.success(`已设置第二点 §f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  }

  if (session.pos1 && session.pos2) {
    const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid);
    Msg.info(info, player);
    Msg.tips("使用 §a!land §7打开菜单确认申请，或使用 §a!land cancel §7取消", player);
  } else {
    const next = which === 1 ? "2" : "1";
    Msg.tips(`请使用 §a!pos${next} §7设置第${next}点`, player);
  }
}
