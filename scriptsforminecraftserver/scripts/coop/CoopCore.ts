/* ---------------------------------------- *\
 *  合作社核心逻辑
\* ---------------------------------------- */

import { system, world, Player, ItemStack, EntityInventoryComponent } from "@minecraft/server";
import { Money } from "../libs/Money";
import { Msg } from "../libs/Tools";
import { Database, CoopData } from "./Database";

export class CoopCore {
  // ==========================================
  //  内部工具
  // ==========================================

  private static _guidCounter = 0;

  static generateId(): string {
    return `${Date.now().toString(36)}_${(++this._guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
    const cfg = Database.getConfig().shop_setting.nbtgoods_condition;
    if (cfg.type_enum.indexOf(item.typeId) !== -1) return true;
    if (item.getComponent("minecraft:enchantments")) return true;
    for (const reg of cfg.type_reg_enum) {
      if (new RegExp(reg).test(item.typeId)) return true;
    }
    return false;
  }

  private static _isBlockType(typeId: string): boolean {
    const nonBlock = ["_sword", "_axe", "_shovel", "_hoe", "_pickaxe", "bow", "arrow",
      "helmet", "chestplate", "leggings", "boots", "potion", "splash_potion",
      "lingering_potion", "spawn_egg", "writable_book", "enchanted_book", "shield",
      "trident", "mace", "elytra", "saddle", "horse_armor"];
    for (const suffix of nonBlock) {
      if (typeId.endsWith(suffix)) return false;
    }
    return true;
  }

  static typeGood(item: ItemStack): string[] {
    const rtv: string[] = [];
    const groups = Database.getAllGroups().filter((g) => g.type_function);
    for (const g of groups) {
      const tf = g.type_function!;
      if (tf.type_enum && tf.type_enum.indexOf(item.typeId) !== -1) { rtv.push(g.groupid); continue; }
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

  static registerCoop(name: string, cid: string, player: Player): boolean {
    if (Database.getAllCoop().some((e) => e.cid === cid)) return false;
    if (Money.get(player) < 1000) return false;

    const coop: CoopData = {
      cid, name,
      members: [{ name: player.name, isop: true }],
      notice: "社长很懒，没有写公告～", money: 0, moneylist: "",
    };
    Money.set(player, Money.get(player) - 1000);
    Database.saveCoop(coop);
    return true;
  }

  static releaseCoop(cid: string) {
    Database.deleteCoop(cid);
    Database.deleteGoodsByCid(cid);
  }

  static joinCoop(player: Player, cid: string) {
    const data = Database.getCoopByCid(cid);
    if (!data || data.members.some((m) => m.name === player.name)) return;

    data.members.push({ name: player.name, isop: false });
    Database.saveCoop(data);

    this.sendToMembers(cid, `欢迎 ${player.name} 加入合作社！`);
  }

  static exitCoop(playerName: string, cid: string) {
    const data = Database.getCoopByCid(cid);
    if (!data) return;
    data.members = data.members.filter((m) => m.name !== playerName);
    Database.saveCoop(data);
  }

  static sendToMembers(cid: string, text: string) {
    const data = Database.getCoopByCid(cid);
    if (!data) return;
    for (const member of data.members) {
      for (const p of world.getPlayers({ name: member.name })) {
        Msg.info(`[${data.name}] ${text}`, p);
      }
    }
  }

  static getInfo(cid: string): string {
    const data = Database.getCoopByCid(cid);
    if (!data) return "合作社不存在";
    const ops = data.members.filter((m) => m.isop).map((m) => m.name).join(", ");
    return `公告：\n${data.notice}\n\n合作社名称: ${data.name}\n社长&管理: ${ops}\n人数: ${data.members.length}\n银行经济: ${data.money}`;
  }

  static getMemberList(cid: string): string[] {
    const data = Database.getCoopByCid(cid);
    return data ? data.members.map((m) => m.name) : [];
  }

  static isOp(playerName: string, cid: string): boolean {
    const data = Database.getCoopByCid(cid);
    return data?.members.find((m) => m.name === playerName)?.isop ?? false;
  }

  static setOp(cid: string, index: number) {
    const data = Database.getCoopByCid(cid);
    if (!data || index >= data.members.length) return;
    data.members[index].isop = true;
    Database.saveCoop(data);
  }

  static setNotice(cid: string, text: string) {
    const data = Database.getCoopByCid(cid);
    if (!data) return;
    data.notice = text;
    Database.saveCoop(data);
  }

  // ==========================================
  //  银行操作
  // ==========================================

  static bankControl(cid: string, player: Player, val: number, note: string, type: number): boolean {
    const data = Database.getCoopByCid(cid);
    if (!data) return false;

    if (type === 1) {
      const plMoney = Money.get(player);
      if (plMoney < val) return false;
      Money.set(player, plMoney - val);
      data.money += val;
      data.moneylist = `【+】${val} ${player.name} ${note}\n${data.moneylist}`;
    } else if (type === 2) {
      if (data.money < val) return false;
      Money.set(player, Money.get(player) + val);
      data.money -= val;
      data.moneylist = `【-】${val} ${player.name} ${note}\n${data.moneylist}`;
    } else return false;

    Database.saveCoop(data);
    return true;
  }

  // ==========================================
  //  排行榜
  // ==========================================

  static getRankInfo(type: number): string {
    const all = Database.getAllCoop();
    if (type === 1) {
      return all.map((e) => ({ m: e.money, n: e.name }))
        .sort((a, b) => b.m - a.m)
        .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} ${Money.UNIT}`).join("");
    }
    if (type === 2) {
      return all.map((e) => ({ m: e.members.length, n: e.name }))
        .sort((a, b) => b.m - a.m)
        .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} 人`).join("");
    }
    return "";
  }

  // ==========================================
  //  商店系统
  // ==========================================

  static getGoods(list: number, reverse: boolean, type: number, cid?: string, groupid?: string, onlyTrue = true) {
    let data = Database.getAllGoods();
    if (onlyTrue) data = data.filter((e) => e.isTrue);
    data = data.filter((e) => e.type === type);
    if (cid) data = data.filter((e) => e.cid === cid);
    if (groupid) data = data.filter((e) => e.groups.indexOf(groupid) !== -1);

    switch (list) {
      case 1: data.sort((a, b) => a.time - b.time); break;
      case 2: data.sort((a, b) => a.name.localeCompare(b.name, Database.getConfig().main.compare_language)); break;
      case 3: data.sort((a, b) => a.sv - b.sv); break;
      case 4: data.sort((a, b) => a.money - b.money); break;
    }
    if (reverse) data.reverse();
    return data;
  }

  static getGroups(customOnly = false) {
    const groups = Database.getAllGroups();
    return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
  }

  static buy(gid: string, num: number, player: Player): boolean {
    const good = Database.getGoodById(gid);
    if (!good || good.num < num) return false;

    const total = good.money * num;
    if (!this.bankControl(good.cid, player, total, `购买 ${good.name}*${num}`, 1)) return false;

    player.runCommand(`give "${player.name}" ${good.item.type} ${num} ${good.item.aux}`);
    good.sv += num;
    good.num -= num;
    Database.saveGood(good);
    return true;
  }

  static sell(gid: string, num: number, player: Player): boolean {
    const good = Database.getGoodById(gid);
    if (!good || good.num - good.sv < num) return false;

    const has = this._countItemInInventory(player, good.item.type);
    if (has < num) return false;

    const total = good.money * num;
    if (!this.bankControl(good.cid, player, total, `出售 ${good.name}*${num}`, 2)) return false;

    player.runCommand(`clear "${player.name}" ${good.item.type} ${good.item.aux} ${num}`);
    good.sv += num;
    Database.saveGood(good);
    return true;
  }
}
