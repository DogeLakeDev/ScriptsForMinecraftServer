/* ---------------------------------------- *\
 *  Name        :  Cooperative          *
 *  Description :  合作社 *
 *  Version     :  1.1.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { EntityInventoryComponent, ItemStack, Player, world } from "@minecraft/server";
import type { CoopShopItem } from "@sfmc/types";
import { CoopApi } from "@sfmc/module-coop-gui";
import { debug } from "../../../../../scriptsforminecraftserver/scripts/libs/DebugLog.js";
import { Money } from "../../../../../scriptsforminecraftserver/scripts/libs/Economy.js";
import { Msg } from "../../../../../scriptsforminecraftserver/scripts/libs/Tools.js";

export class CoopCore {
  // ==========================================
  //  内部工具
  // ==========================================

  private static _guidCounter = 0;

  private static cooperativeConfig = {
    main: { language: "zh_CN", compare_language: "zh" },
    shop_setting: {
      nbtgoods_condition: {
        type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
        mode_enum: ["it.isEnchanted"],
        type_reg_enum: ["[a-z].+_shulker_box"],
      },
    },
  };

  static generateId(): string {
    return `${Date.now().toString(36)}_${(++this._guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private static _countItemInInventory(player: Player, typeId: string): number {
    const inv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
    if (!inv?.container) return 0;
    let total = 0;
    for (let i = 0; i < inv.container.size; i++) {
      const item = inv.container.getItem(i);
      if (item?.typeId === typeId && item.amount) total += item.amount;
    }
    return total;
  }

  static isNbtItem(item: ItemStack): boolean {
    const cfg = this.cooperativeConfig.shop_setting.nbtgoods_condition;
    if (cfg.type_enum.indexOf(item.typeId) !== -1) return true;
    if (item.getComponent("minecraft:enchantments")) return true;
    for (const reg of cfg.type_reg_enum) {
      if (new RegExp(reg).test(item.typeId)) return true;
    }
    return false;
  }

  private static _isBlockType(typeId: string): boolean {
    const nonBlock = [
      "_sword",
      "_axe",
      "_shovel",
      "_hoe",
      "_pickaxe",
      "bow",
      "arrow",
      "helmet",
      "chestplate",
      "leggings",
      "boots",
      "potion",
      "splash_potion",
      "lingering_potion",
      "spawn_egg",
      "writable_book",
      "enchanted_book",
      "shield",
      "trident",
      "mace",
      "elytra",
      "saddle",
      "horse_armor",
    ];
    for (const suffix of nonBlock) {
      if (typeId.endsWith(suffix)) return false;
    }
    return true;
  }

  static async typeGood(item: ItemStack): Promise<string[]> {
    const rtv: string[] = [];
    const groups = (await CoopApi.getAllShopGroups()).filter((g) => g.type_function);
    for (const g of groups) {
      const tfRaw = g.type_function;
      if (!tfRaw) continue;
      const tf = typeof tfRaw === "string" ? JSON.parse(tfRaw) : tfRaw;
      if (tf.type_enum && tf.type_enum.indexOf(item.typeId) !== -1) {
        rtv.push(g.groupid);
        continue;
      }
      if (tf.mode_enum) {
        for (const mode of tf.mode_enum) {
          if (mode === "default_block" && this._isBlockType(item.typeId)) rtv.push(g.groupid);
          if (mode === "default_item" && !this._isBlockType(item.typeId)) rtv.push(g.groupid);
        }
      }
      if (tf.type_reg_enum) {
        for (const reg of tf.type_reg_enum) {
          if (new RegExp(reg).test(item.typeId)) rtv.push(g.groupid);
        }
      }
    }
    return rtv;
  }

  // ==========================================
  //  合作社操作
  // ==========================================

  static async registerCoop(name: string, cid: string, player: Player): Promise<boolean> {
    debug.i("COOP", `registerCoop: name=${name} cid=${cid} player=${player.name}`);
    const result = await CoopApi.createCoop(name.trim(), cid.trim(), player.id, player.name);
    if (!result.ok) {
      debug.w("COOP", `registerCoop: failed name=${name} cid=${cid}`);
      return false;
    }
    if (result.balance !== undefined) Money.setCached(player, result.balance);
    else await Money.load(player);
    debug.i("COOP", `registerCoop: success cid=${cid}`);
    return true;
  }

  static async releaseCoop(cid: string, actorId: string): Promise<boolean> {
    debug.i("COOP", `releaseCoop: cid=${cid} actorId=${actorId}`);
    const ok = await CoopApi.deleteCoop(cid, actorId);
    debug.i("COOP", `releaseCoop: ${ok ? "success" : "failed"} cid=${cid}`);
    return ok;
  }

  static async joinCoop(player: Player, cid: string): Promise<boolean> {
    debug.i("COOP", `joinCoop: player=${player.name} cid=${cid}`);
    const data = await CoopApi.getCoop(cid);
    if (!data || (data.members || []).some((m) => m.player_id === player.id)) {
      debug.w("COOP", `joinCoop: already member or not found cid=${cid}`);
      return false;
    }

    if (!(await CoopApi.joinCoop(cid, player.id, player.name))) {
      debug.e("COOP", `joinCoop: API failed cid=${cid}`);
      return false;
    }

    this.sendToMembers(cid, `欢迎 ${player.name} 加入合作社！`);
    debug.i("COOP", `joinCoop: success cid=${cid}`);
    return true;
  }

  static async exitCoop(playerId: string, cid: string) {
    debug.i("COOP", `exitCoop: playerId=${playerId} cid=${cid}`);
    const data = await CoopApi.getCoop(cid);
    if (!data) {
      debug.w("COOP", "exitCoop: coop not found");
      return;
    }
    await CoopApi.leaveCoop(cid, playerId);
  }

  static async sendToMembers(cid: string, text: string) {
    const data = await CoopApi.getCoop(cid);
    if (!data) return;
    let sent = 0;
    for (const member of data.members || []) {
      for (const p of world.getPlayers())
        if (p.id === member.player_id) {
          Msg.info(`[${data.name}] ${text}`, p);
          sent++;
        }
    }
    debug.i("COOP", `sendToMembers: cid=${cid} sent=${sent}`);
  }

  static async getInfo(cid: string): Promise<string> {
    const data = await CoopApi.getCoop(cid);
    if (!data) {
      debug.w("COOP", `getInfo: coop not found cid=${cid}`);
      return "合作社不存在";
    }
    const ops = (data.members || [])
      .filter((m) => m.role === "owner" || m.role === "admin")
      .map((m) => m.player_name_snapshot)
      .join(", ");
    return `合作社名称: ${data.name}\n社长&管理: ${ops}\n成员: \n${(data.members || []).join("\n")}\n银行经济: ${data.account?.balance || 0}`;
  }

  static async getMemberList(cid: string): Promise<string[]> {
    const data = await CoopApi.getCoop(cid);
    const list = data ? (data.members || []).map((m) => m.player_name_snapshot) : [];
    debug.i("COOP", `getMemberList: cid=${cid} count=${list.length}`);
    return list;
  }

  static async isOp(playerId: string, cid: string): Promise<boolean> {
    const data = await CoopApi.getCoop(cid);
    const result =
      (data?.members || []).find((m) => m.player_id === playerId)?.role === "owner" ||
      (data?.members || []).find((m) => m.player_id === playerId)?.role === "admin";
    debug.i("COOP", `isOp: playerId=${playerId} cid=${cid} result=${result}`);
    return result;
  }

  static async setOp(cid: string, index: number) {
    debug.i("COOP", `setOp: cid=${cid} index=${index}`);
    const data = await CoopApi.getCoop(cid);
    if (!data || !data.members || index >= data.members.length) {
      debug.w("COOP", "setOp: invalid index or data");
      return;
    }
    const member = data.members[index];
    if (!member) {
      debug.w("COOP", "setOp: member is undefined");
      return;
    }
    await CoopApi.updateMemberRole(cid, data.owner_player_id, member.player_id, "admin");
  }

  // ==========================================
  //  银行操作
  // ==========================================

  static async bankControl(
    cid: string,
    player: Player,
    val: number,
    note: string,
    type: number
  ): Promise<{ ok: boolean; error?: string }> {
    debug.i(
      "COOP",
      `bankControl: cid=${cid} player=${player.name} val=${val} type=${type === 1 ? "deposit" : "withdraw"}`
    );
    const result = await CoopApi.treasury(cid, player.id, player.name, type === 1 ? "deposit" : "withdraw", val, note);
    if (!result.ok) {
      debug.e("COOP", `bankControl: failed ${result.error}`);
      return { ok: false, error: result.error || "银行操作失败" };
    }
    if (result.playerBalance !== undefined) Money.setCached(player, result.playerBalance);
    debug.i("COOP", "bankControl: success");
    return { ok: true };
  }

  // ==========================================
  //  排行榜
  // ==========================================

  static async getRankInfo(type: number): Promise<string> {
    debug.i("COOP", `getRankInfo: type=${type}`);
    const all = await CoopApi.getAllCoops();
    if (type === 1) {
      return all
        .map((e) => ({ m: e.account?.balance || 0, n: e.name }))
        .sort((a, b) => b.m - a.m)
        .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} ${Money.UNIT}`)
        .join("");
    }
    if (type === 2) {
      return all
        .map((e) => ({ m: (e.members || []).length, n: e.name }))
        .sort((a, b) => b.m - a.m)
        .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} 人`)
        .join("");
    }
    return "";
  }

  // ==========================================
  //  商店系统
  // ==========================================

  private static async _getAllShopItems(): Promise<CoopShopItem[]> {
    const allCoops = await CoopApi.getAllCoops();
    const items: CoopShopItem[] = [];
    for (const c of allCoops) {
      const shopItems = await CoopApi.getShopItems(c.cid);
      items.push(...shopItems);
    }
    return items;
  }

  static async getGoods(list: number, reverse: boolean, type: number, cid?: string, groupid?: string, onlyTrue = true) {
    debug.i("COOP", `getGoods: list=${list} type=${type} cid=${cid} groupid=${groupid}`);
    let data = await this._getAllShopItems();
    if (onlyTrue) data = data.filter((e) => e.is_true !== false);
    data = data.filter((e) => e.type === type);
    if (cid) data = data.filter((e) => e.cid === cid);
    if (groupid) data = data.filter((e) => e.groups && e.groups.indexOf(groupid) !== -1);

    switch (list) {
      case 1:
        data.sort((a, b) => a.created_at - b.created_at);
        break;
      case 2:
        data.sort((a, b) => a.name.localeCompare(b.name, this.cooperativeConfig.main.compare_language));
        break;
      case 3:
        data.sort((a, b) => a.sv - b.sv);
        break;
      case 4:
        data.sort((a, b) => a.money - b.money);
        break;
    }
    if (reverse) data.reverse();
    return data;
  }

  static async getGroups(customOnly = false) {
    const groups = await CoopApi.getAllShopGroups();
    debug.i("COOP", `getGroups: customOnly=${customOnly} count=${groups.length}`);
    return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
  }

  static async buy(gid: string, num: number, player: Player): Promise<{ ok: boolean; error?: string }> {
    debug.i("COOP", `buy: gid=${gid} num=${num} player=${player.name}`);
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num < num) {
      debug.w("COOP", `buy: insufficient stock gid=${gid}`);
      return { ok: false, error: "商品库存不足" };
    }

    const idempotencyKey = `buy_${player.id}_${gid}_${num}_${Date.now()}`;
    const result = await CoopApi.coopShopBuy(good.cid, player.id, player.name, gid, num, idempotencyKey);
    if (!result.ok) {
      debug.e("COOP", `buy: API failed ${result.error}`);
      return { ok: false, error: result.error || "购买失败" };
    }

    try {
      player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
    } catch {
      Msg.error("物品发放失败，请联系管理员。", player);
      return { ok: false, error: "give_failed" };
    }

    good.sv += num;
    good.num -= num;
    if (result.balance !== undefined) Money.setCached(player, result.balance, result.balanceVersion);
    debug.i("COOP", `buy: success gid=${gid}`);
    return { ok: true };
  }

  static async sell(gid: string, num: number, player: Player): Promise<{ ok: boolean; error?: string }> {
    debug.i("COOP", `sell: gid=${gid} num=${num} player=${player.name}`);
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num - good.sv < num) {
      debug.w("COOP", `sell: insufficient capacity gid=${gid}`);
      return { ok: false, error: "商品容量不足" };
    }

    const has = this._countItemInInventory(player, good.item_type);
    if (has < num) {
      debug.w("COOP", `sell: not enough items in inventory gid=${gid}`);
      return { ok: false, error: "背包物品不足" };
    }

    try {
      player.runCommand(`clear @s ${good.item_type} ${good.item_aux ?? 0} ${num}`);
    } catch {
      Msg.error("从背包扣除物品失败。", player);
      return { ok: false, error: "clear_failed" };
    }

    const idempotencyKey = `sell_${player.id}_${gid}_${num}_${Date.now()}`;
    const result = await CoopApi.coopShopSell(good.cid, player.id, player.name, gid, num, idempotencyKey);
    if (!result.ok) {
      try {
        player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
      } catch {}
      Msg.error(`出售失败：${result.error || "服务器错误"}，物品已返还。`, player);
      debug.e("COOP", `sell: API failed ${result.error}`);
      return { ok: false, error: result.error || "shop_sell_failed" };
    }

    good.sv += num;
    if (result.balance !== undefined) Money.setCached(player, result.balance, result.balanceVersion);
    debug.i("COOP", `sell: success gid=${gid}`);
    return { ok: true };
  }
}