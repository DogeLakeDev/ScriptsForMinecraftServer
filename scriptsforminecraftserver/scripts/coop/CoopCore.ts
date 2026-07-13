/* ---------------------------------------- *\
 *  合作社核心逻辑
\* ---------------------------------------- */

import { system, world, Player, ItemStack, EntityInventoryComponent } from "@minecraft/server";
import { Money } from "../libs/Money";
import { Msg } from "../libs/Tools";
import type { CoopData, CoopShopItem } from "../types";
import {
  getCoop,
  getAllCoops,
  createCoop,
  updateCoop,
  deleteCoop,
  addMember,
  removeMember,
  getShopItems,
  saveShopItem,
  getAllShopGroups,
  addBankLog,
} from "../api";

export class CoopCore {
  // ==========================================
  //  内部工具
  // ==========================================

  private static _guidCounter = 0;

  private static cooperativeConfig = {
    main: { language: "zh_CN", compare_language: "zh" },
    shop_setting: {
      monetary_unit: "¥",
      nbtgoods_condition: {
        type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
        mode_enum: ["it.isEnchanted"],
        type_reg_enum: ["[a-z].+_shulker_box"],
      },
    },
  };

  static generateId(): string {
    return `${Date.now().toString(36)}_${(++this._guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  static getConfig() {
    return this.cooperativeConfig;
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
    const groups = (await getAllShopGroups()).filter((g) => g.type_function);
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
    const all = await getAllCoops();
    if (all.some((e) => e.cid === cid)) return false;
    if ((await Money.load(player)) < 1000) return false;

    const coop: CoopData = {
      cid,
      name,
      owner_name: player.name,
      members: [{ player_name: player.name, is_op: true, joined_at: Date.now() }],
      notice: "社长很懒，没有写公告～",
      money: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    if (!(await Money.add(player, -1000))) return false;
    await createCoop(coop);
    return true;
  }

  static async releaseCoop(cid: string) {
    await deleteCoop(cid);
  }

  static async joinCoop(player: Player, cid: string) {
    const data = await getCoop(cid);
    if (!data || (data.members || []).some((m) => m.player_name === player.name)) return;

    await addMember(cid, player.name, false);

    this.sendToMembers(cid, `欢迎 ${player.name} 加入合作社！`);
  }

  static async exitCoop(playerName: string, cid: string) {
    const data = await getCoop(cid);
    if (!data) return;
    await removeMember(cid, playerName);
  }

  static async sendToMembers(cid: string, text: string) {
    const data = await getCoop(cid);
    if (!data) return;
    for (const member of data.members || []) {
      for (const p of world.getPlayers({ name: member.player_name })) {
        Msg.info(`[${data.name}] ${text}`, p);
      }
    }
  }

  static async getInfo(cid: string): Promise<string> {
    const data = await getCoop(cid);
    if (!data) return "合作社不存在";
    const ops = (data.members || [])
      .filter((m) => m.is_op)
      .map((m) => m.player_name)
      .join(", ");
    return `公告：\n${data.notice}\n\n合作社名称: ${data.name}\n社长&管理: ${ops}\n人数: ${(data.members || []).length}\n银行经济: ${data.money}`;
  }

  static async getMemberList(cid: string): Promise<string[]> {
    const data = await getCoop(cid);
    return data ? (data.members || []).map((m) => m.player_name) : [];
  }

  static async isOp(playerName: string, cid: string): Promise<boolean> {
    const data = await getCoop(cid);
    return (data?.members || []).find((m) => m.player_name === playerName)?.is_op ?? false;
  }

  static async setOp(cid: string, index: number) {
    const data = await getCoop(cid);
    if (!data || !data.members || index >= data.members.length) return;
    const members = data.members.map((m, i) => (i === index ? { ...m, is_op: true } : m));
    await updateCoop(cid, { members });
  }

  static async setNotice(cid: string, text: string) {
    const data = await getCoop(cid);
    if (!data) return;
    await updateCoop(cid, { notice: text });
  }

  // ==========================================
  //  银行操作
  // ==========================================

  static async bankControl(cid: string, player: Player, val: number, note: string, type: number): Promise<boolean> {
    const data = await getCoop(cid);
    if (!data) return false;

    if (type === 1) {
      const plMoney = await Money.load(player);
      if (plMoney < val) return false;
      if (!(await Money.add(player, -val))) return false;
      await updateCoop(cid, { money: (data.money || 0) + val });
      await addBankLog(cid, player.name, 1, val, note);
    } else if (type === 2) {
      if ((data.money || 0) < val) return false;
      if (!(await Money.add(player, val))) return false;
      await updateCoop(cid, { money: (data.money || 0) - val });
      await addBankLog(cid, player.name, 2, val, note);
    } else return false;

    return true;
  }

  // ==========================================
  //  排行榜
  // ==========================================

  static async getRankInfo(type: number): Promise<string> {
    const all = await getAllCoops();
    if (type === 1) {
      return all
        .map((e) => ({ m: e.money || 0, n: e.name }))
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
    const allCoops = await getAllCoops();
    const items: CoopShopItem[] = [];
    for (const c of allCoops) {
      const shopItems = await getShopItems(c.cid);
      items.push(...shopItems);
    }
    return items;
  }

  static async getGoods(list: number, reverse: boolean, type: number, cid?: string, groupid?: string, onlyTrue = true) {
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
    const groups = await getAllShopGroups();
    return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
  }

  static async buy(gid: string, num: number, player: Player): Promise<boolean> {
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num < num) return false;

    const total = good.money * num;
    if (!(await this.bankControl(good.cid, player, total, `购买 ${good.name}*${num}`, 1))) return false;

    player.runCommand(`give "${player.name}" ${good.item_type} ${num} ${good.item_aux ?? 0}`);
    good.sv += num;
    good.num -= num;
    await saveShopItem(good);
    return true;
  }

  static async sell(gid: string, num: number, player: Player): Promise<boolean> {
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num - good.sv < num) return false;

    const has = this._countItemInInventory(player, good.item_type);
    if (has < num) return false;

    const total = good.money * num;
    if (!(await this.bankControl(good.cid, player, total, `出售 ${good.name}*${num}`, 2))) return false;

    player.runCommand(`clear "${player.name}" ${good.item_type} ${good.item_aux ?? 0} ${num}`);
    good.sv += num;
    await saveShopItem(good);
    return true;
  }
}
