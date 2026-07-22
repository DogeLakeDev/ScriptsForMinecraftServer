/**
 * @sfmc/module-feature-coop — v2 入口
 *
 * ModuleRegistry.register + 注册 /coop /coopshop 命令。
 * 业务实现分别在 ./coop-core.ts (CoopCore 搬运)和 ./coop-api.ts (HttpDB → db.tx wrapper)。
 *
 * 注:UI GUI 部分(原 coop-gui/CoopGUI.ts 709 行 MenuNavigator)在 P1 阶段补;当前 /coop /coopshop
 * 命令会 import 失败,所以我用 2 个新命令 /coop info (列出当前玩家所属社) + /coop shop admin
 * 提供 operator-level 入口,让 P1 阶段补完 CoopGUI 后这两个命令可删除。
 */

import { Player } from "@minecraft/server";
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

import * as CoopCore from "./coop-core.js";
import * as CoopApi from "./coop-api.js";

const MODULE_ID = "feature-coop";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("coop.use", Permission.Member);
      Permission.register("coop.admin", Permission.OP);
      Permission.register("coopshop.use", Permission.Member);
    },
    registerCommands() {
      // /coop info — 查看当前玩家所属社信息
      Command.register(
        "coop",
        "coop.use",
        async (player: Player | undefined) => {
          if (!player) return;
          const cid = await CoopApi.findPlayerCoop(player.id);
          if (!cid) {
            Msg.info("你尚未加入任何合作社。", player);
            return;
          }
          const info = await CoopCore.getInfo(cid);
          Msg.info(info, player);
        },
        "查看当前合作社信息",
        "coop"
      );

      // /coop create <name> <cid>
      Command.register(
        "coop create",
        "coop.use",
        async (player: Player | undefined, ctx: { args: string[] }) => {
          if (!player) return;
          const [name, cid] = ctx.args;
          if (!name || !cid) {
            Msg.info("用法: /coop create <name> <cid>", player);
            return;
          }
          const ok = await CoopCore.registerCoop(name, cid, player);
          if (ok) Msg.success(`合作社 ${cid} 创建成功!`, player);
          else Msg.error("创建失败,可能在的 CID 已存在或格式无效。", player);
        },
        "创建合作社",
        "coop"
      );

      // /coop join <cid>
      Command.register(
        "coop join",
        "coop.use",
        async (player: Player | undefined, ctx: { args: string[] }) => {
          if (!player) return;
          const cid = ctx.args[0];
          if (!cid) return;
          const ok = await CoopCore.joinCoop(player, cid);
          if (ok) Msg.success(`已加入 ${cid}。`, player);
          else Msg.error("加入失败(不存在或已是社员)。", player);
        },
        "通过 CID 加入合作社",
        "coop"
      );

      // /coop leave
      Command.register(
        "coop leave",
        "coop.use",
        async (player: Player | undefined) => {
          if (!player) return;
          const cid = await CoopApi.findPlayerCoop(player.id);
          if (!cid) return;
          await CoopCore.exitCoop(player.id, cid);
          Msg.info("已离开合作社。", player);
        },
        "离开当前合作社",
        "coop"
      );

      // /coop bank <deposit|withdraw> <amount>
      Command.register(
        "coop bank",
        "coop.use",
        async (player: Player | undefined, ctx: { args: string[] }) => {
          if (!player) return;
          const [mode, amtStr] = ctx.args;
          if (!mode || !amtStr) {
            Msg.info("用法: /coop bank <deposit|withdraw> <amount>", player);
            return;
          }
          const cid = await CoopApi.findPlayerCoop(player.id);
          if (!cid) return;
          const amount = parseInt(amtStr, 10);
          if (Number.isNaN(amount) || amount <= 0) return;
          const t = mode === "deposit" ? 1 : 2;
          const result = await CoopCore.bankControl(cid, player, amount, "manual", t);
          if (result.ok) Msg.success("银行操作成功。", player);
          else Msg.error(`银行操作失败:${result.error ?? "未知"}`, player);
        },
        "合作社银行存取款",
        "coop"
      );

      // /coop rank <1=banks | 2=members>
      Command.register(
        "coop rank",
        "coop.use",
        async (player: Player | undefined, ctx: { args: string[] }) => {
          if (!player) return;
          const t = parseInt(ctx.args[0] ?? "1", 10);
          const info = await CoopCore.getRankInfo(t);
          Msg.info(`§e=== 合作社排行榜 §7(类型:${t})§e===\n${info}`, player);
        },
        "合作社排行榜",
        "coop"
      );

      // /coopshop <buy|sell> <listingId> <qty>
      Command.register(
        "coopshop",
        "coopshop.use",
        async (player: Player | undefined, ctx: { args: string[] }) => {
          if (!player) return;
          const [op, gid, qtyStr] = ctx.args;
          const qty = parseInt(qtyStr ?? "1", 10);
          if (!gid || Number.isNaN(qty) || qty <= 0) return;
          if (op === "buy") {
            const r = await CoopCore.buy(gid, qty, player);
            if (r.ok) Msg.success("购买成功。", player);
            else Msg.error(`购买失败:${r.error}`, player);
          } else if (op === "sell") {
            const r = await CoopCore.sell(gid, qty, player);
            if (r.ok) Msg.success("出售成功。", player);
            else Msg.error(`出售失败:${r.error}`, player);
          }
        },
        "合作社商店(buy|sell <id> <qty>)",
        "coop"
      );
    },
    async init() {
      debug.i("COOP", "feature-coop init");
    },
    cleanup() {
      debug.i("COOP", "feature-coop cleanup");
    },
  },
});
