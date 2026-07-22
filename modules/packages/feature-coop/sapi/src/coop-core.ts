/**
 * @sfmc/module-feature-coop — coop-core.ts
 *
 * v2 合作社业务逻辑(从 v1 CoopCore.ts 搬运,把 HttpDB 替换为 coop-api.ts 的
 * 直接 db.tx/db.query 包装)。权限工具类函数(无需 HTTP)。
 */

import { EntityInventoryComponent, ItemStack, Player, world } from "@minecraft/server";
import { debug, Money, Msg } from "@sfmc/sdk/sapi/runtime";
import * as CoopApi from "./coop-api.js";
import type { CoopShopItemRow } from "./coop-api.js";

let _guidCounter = 0;

function generateId(): string {
  return `${Date.now().toString(36)}_${(++_guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function _countItemInInventory(player: Player, typeId: string): number {
  const inv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (!inv?.container) return 0;
  let total = 0;
  for (let i = 0; i < inv.container.size; i++) {
    const item = inv.container.getItem(i);
    if (item?.typeId === typeId && item.amount) total += item.amount;
  }
  return total;
}

function _isBlockType(typeId: string): boolean {
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

const _shopCfg = {
  shop_setting: {
    nbtgoods_condition: {
      type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
      mode_enum: ["it.isEnchanted"],
      type_reg_enum: ["[a-z].+_shulker_box"],
    },
  },
};

function _isNbtItem(item: ItemStack): boolean {
  const cfg = _shopCfg.shop_setting.nbtgoods_condition;
  if (cfg.type_enum.indexOf(item.typeId) !== -1) return true;
  if (item.getComponent("minecraft:enchantments")) return true;
  for (const reg of cfg.type_reg_enum) {
    if (new RegExp(reg).test(item.typeId)) return true;
  }
  return false;
}

async function _typeGood(item: ItemStack): Promise<string[]> {
  const rtv: string[] = [];
  const groups = await CoopApi.getAllShopGroups();
  for (const g of groups) {
    if (!g.type_function) continue;
    const tf = JSON.parse(g.type_function);
    if (tf.type_enum && tf.type_enum.indexOf(item.typeId) !== -1) {
      rtv.push(g.groupid);
      continue;
    }
    if (tf.mode_enum) {
      for (const mode of tf.mode_enum) {
        if (mode === "default_block" && _isBlockType(item.typeId)) rtv.push(g.groupid);
        if (mode === "default_item" && !_isBlockType(item.typeId)) rtv.push(g.groupid);
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

// ─── 合作社操作 ───

export async function registerCoop(name: string, cid: string, player: Player): Promise<boolean> {
  const result = await CoopApi.createCoop(name.trim(), cid.trim(), player.id, player.name);
  if (!result.ok) {
    debug.w("COOP", `registerCoop: failed name=${name} cid=${cid}`);
    return false;
  }
  Money.load(player).catch(() => {});
  return true;
}

export async function releaseCoop(cid: string, actorId: string): Promise<boolean> {
  const ok = await CoopApi.deleteCoop(cid, actorId);
  return ok;
}

export async function joinCoop(player: Player, cid: string): Promise<boolean> {
  const members = await CoopApi.getMembers(cid);
  if (members.some((m) => m.player_id === player.id)) return false;
  const ok = await CoopApi.joinCoop(cid, player.id, player.name);
  if (!ok) return false;
  await sendToMembers(cid, `欢迎 ${player.name} 加入合作社!`);
  return true;
}

export async function exitCoop(playerId: string, cid: string): Promise<void> {
  await CoopApi.leaveCoop(cid, playerId);
}

export async function sendToMembers(cid: string, text: string): Promise<void> {
  const coop = await CoopApi.getCoop(cid);
  if (!coop) return;
  const members = await CoopApi.getMembers(cid);
  let sent = 0;
  for (const m of members) {
    for (const p of world.getAllPlayers()) {
      if (p.id === m.player_id) {
        Msg.info(`[${coop.name}] ${text}`, p);
        sent++;
      }
    }
  }
  debug.i("COOP", `sendToMembers: cid=${cid} sent=${sent}`);
}

export async function getInfo(cid: string): Promise<string> {
  const coop = await CoopApi.getCoop(cid);
  if (!coop) return "合作社不存在";
  const members = await CoopApi.getMembers(cid);
  const ops = members
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => m.player_name_snapshot)
    .join(", ");
  const account = await CoopApi.getBankAccount(cid);
  return `合作社名称: ${coop.name}\n社长&管理: ${ops}\n成员: ${members.length}人\n银行经济: ${account?.balance ?? 0}`;
}

export async function getMemberList(cid: string): Promise<string[]> {
  const members = await CoopApi.getMembers(cid);
  return members.map((m) => m.player_name_snapshot);
}

export async function isOp(playerId: string, cid: string): Promise<boolean> {
  const members = await CoopApi.getMembers(cid);
  const me = members.find((m) => m.player_id === playerId);
  return me?.role === "owner" || me?.role === "admin";
}

export async function setOp(cid: string, index: number, actorId: string): Promise<void> {
  const members = await CoopApi.getMembers(cid);
  const target = members[index];
  if (!target) return;
  await CoopApi.updateMemberRole(cid, actorId, target.player_id, "admin");
}

// ─── 银行 ───

export async function bankControl(
  cid: string,
  player: Player,
  val: number,
  note: string,
  type: number
): Promise<{ ok: boolean; error?: string }> {
  const mode = type === 1 ? "deposit" : "withdraw";
  const result = await CoopApi.treasury(cid, player.id, player.name, mode, val, note);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ─── 排行榜 ───

export async function getRankInfo(type: number): Promise<string> {
  const all = await CoopApi.getAllCoops();
  if (type === 1) {
    const items = await Promise.all(
      all.map(async (e) => ({
        m: (await CoopApi.getBankAccount(e.cid))?.balance ?? 0,
        n: e.name,
      }))
    );
    return items
      .sort((a, b) => b.m - a.m)
      .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} ${Money.UNIT}`)
      .join("");
  }
  if (type === 2) {
    const items = await Promise.all(
      all.map(async (e) => ({
        m: (await CoopApi.getMembers(e.cid)).length,
        n: e.name,
      }))
    );
    return items
      .sort((a, b) => b.m - a.m)
      .map((e, i) => `\n#${i + 1} ${e.n} > ${e.m} 人`)
      .join("");
  }
  return "";
}

// ─── 商店 ───

async function _getAllShopItems(): Promise<CoopShopItemRow[]> {
  const allCoops = await CoopApi.getAllCoops();
  const items: CoopShopItemRow[] = [];
  for (const c of allCoops) {
    const shopItems = await CoopApi.getShopItems(c.cid);
    items.push(...shopItems);
  }
  return items;
}

export async function getGoods(
  list: number,
  reverse: boolean,
  type: number,
  cid?: string,
  groupid?: string,
  onlyTrue = true
): Promise<CoopShopItemRow[]> {
  let data = await _getAllShopItems();
  if (onlyTrue) data = data.filter((e) => e.is_true !== 0 && e.is_true !== false as unknown);
  data = data.filter((e) => e.type === type);
  if (cid) data = data.filter((e) => e.cid === cid);
  if (groupid) data = data.filter((e) => e.groups && e.groups.indexOf(groupid) !== -1);

  switch (list) {
    case 1:
      data.sort((a, b) => a.created_at - b.created_at);
      break;
    case 2:
      data.sort((a, b) => a.name.localeCompare(b.name, "zh"));
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

export async function getGroups(customOnly = false) {
  const groups = await CoopApi.getAllShopGroups();
  return customOnly ? groups.filter((g) => !g.groupid.includes("default")) : groups;
}

export async function buy(gid: string, num: number, player: Player): Promise<{ ok: boolean; error?: string }> {
  const all = await _getAllShopItems();
  const good = all.find((e) => e.id === gid);
  if (!good || (good.num ?? 0) < num) return { ok: false, error: "商品库存不足" };
  const result = await CoopApi.shopBuy(good.cid, player.id, player.name, gid, num);
  if (!result.ok) return { ok: false, error: result.error };
  try {
    player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
  } catch {
    Msg.error("物品发放失败,请联系管理员。", player);
    return { ok: false, error: "give_failed" };
  }
  return { ok: true };
}

export async function sell(gid: string, num: number, player: Player): Promise<{ ok: boolean; error?: string }> {
  const all = await _getAllShopItems();
  const good = all.find((e) => e.id === gid);
  if (!good) return { ok: false, error: "商品不存在" };
  if (((good.num ?? 0) - (good.sv ?? 0)) < num) return { ok: false, error: "商品容量不足" };
  const has = _countItemInInventory(player, good.item_type);
  if (has < num) return { ok: false, error: "背包物品不足" };
  try {
    player.runCommand(`clear @s ${good.item_type} ${good.item_aux ?? 0} ${num}`);
  } catch {
    Msg.error("从背包扣除物品失败。", player);
    return { ok: false, error: "clear_failed" };
  }
  const result = await CoopApi.shopSell(good.cid, player.id, player.name, gid, num);
  if (!result.ok) {
    try {
      player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
    } catch {
      /* ignore */
    }
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

void generateId;
void _typeGood;
void _isNbtItem;
