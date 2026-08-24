/**
 * 假 ItemStack / Container / EntityInventoryComponent — 对照 Learn + pin `.d.ts`。
 */

import { guardUnimplemented, UnimplementedMinecraftApiError } from "../unimplemented-error.js";

function normalizeItemTypeId(id: string): string {
  const s = String(id ?? "").trim();
  if (!s) throw new Error("Invalid item type");
  return s.includes(":") ? s : `minecraft:${s}`;
}

export type FakeItemType = { id: string };

export class ItemStack {
  amount: number;
  keepOnDeath = false;
  nameTag?: string;
  lockMode = "none";
  readonly type: FakeItemType;
  readonly typeId: string;
  readonly maxAmount: number;
  readonly localizationKey: string;

  constructor(itemType: string | FakeItemType, amount = 1) {
    const id =
      typeof itemType === "string" ? normalizeItemTypeId(itemType) : normalizeItemTypeId(itemType.id);
    this.typeId = id;
    this.type = { id };
    this.maxAmount = 64;
    this.localizationKey = `item.${id.replace(/^minecraft:/, "")}.name`;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1 || n > 255) {
      throw new Error("ItemStack amount must be between 1 and 255");
    }
    this.amount = Math.min(Math.floor(n), this.maxAmount);
    // 构造返回 Proxy：缺成员硬失败（与 Player/Entity 一致）
    return guardUnimplemented(this, "ItemStack") as ItemStack;
  }

  get isStackable(): boolean {
    return this.maxAmount > 1;
  }

  get weight(): number {
    return this.amount;
  }

  clone(): ItemStack {
    const c = new ItemStack(this.typeId, this.amount);
    c.keepOnDeath = this.keepOnDeath;
    if (this.nameTag !== undefined) c.nameTag = this.nameTag;
    c.lockMode = this.lockMode;
    return c;
  }

  isStackableWith(otherStack: ItemStack): boolean {
    return this.typeId === otherStack.typeId && this.isStackable && otherStack.isStackable;
  }

  getComponent(_componentId: string): undefined {
    return undefined;
  }

  hasComponent(_componentId: string): boolean {
    return false;
  }

  clearDynamicProperties(): void {
    /* noop L2 */
  }

  getDynamicProperty(_id: string): undefined {
    return undefined;
  }

  getDynamicPropertyIds(): string[] {
    return [];
  }

  setDynamicProperty(_id: string, _value?: unknown): void {
    /* noop L2 */
  }
}

export type FakeContainer = {
  size: number;
  isValid: boolean;
  readonly emptySlotsCount: number;
  readonly weight: number;
  getItem(slot: number): ItemStack | undefined;
  setItem(slot: number, itemStack?: ItemStack): void;
  addItem(itemStack: ItemStack): ItemStack | undefined;
  clearAll(): void;
  transferItem(fromSlot: number, toContainer: FakeContainer): ItemStack | undefined;
  swapItems(slot: number, otherSlot: number, otherContainer: FakeContainer): void;
  moveItem(fromSlot: number, toSlot: number, toContainer: FakeContainer): void;
};

function assertSlot(size: number, slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= size) {
    throw new Error(`Invalid container slot ${slot}`);
  }
}

export function createFakeContainer(size: number): FakeContainer {
  const slots: Array<ItemStack | undefined> = Array.from({ length: size }, () => undefined);
  let valid = true;

  const api: FakeContainer = {
    size,
    get isValid() {
      return valid;
    },
    get emptySlotsCount() {
      return slots.filter((s) => s === undefined).length;
    },
    get weight() {
      return slots.reduce((sum, s) => sum + (s?.amount ?? 0), 0);
    },
    getItem(slot) {
      assertSlot(size, slot);
      const item = slots[slot];
      return item ? item.clone() : undefined;
    },
    setItem(slot, itemStack) {
      assertSlot(size, slot);
      slots[slot] = itemStack ? itemStack.clone() : undefined;
    },
    addItem(itemStack) {
      let remaining = itemStack.clone();
      for (let i = 0; i < size; i++) {
        const cur = slots[i];
        if (cur && cur.isStackableWith(remaining)) {
          const space = cur.maxAmount - cur.amount;
          if (space <= 0) continue;
          const move = Math.min(space, remaining.amount);
          cur.amount += move;
          remaining.amount -= move;
          if (remaining.amount <= 0) return undefined;
        }
      }
      for (let i = 0; i < size; i++) {
        if (slots[i] === undefined) {
          slots[i] = remaining;
          return undefined;
        }
      }
      return remaining;
    },
    clearAll() {
      for (let i = 0; i < size; i++) slots[i] = undefined;
    },
    transferItem(fromSlot, toContainer) {
      const item = api.getItem(fromSlot);
      if (!item) return undefined;
      api.setItem(fromSlot, undefined);
      const leftover = toContainer.addItem(item);
      if (leftover) {
        api.setItem(fromSlot, leftover);
        return leftover;
      }
      return undefined;
    },
    swapItems(slot, otherSlot, otherContainer) {
      const a = api.getItem(slot);
      const b = otherContainer.getItem(otherSlot);
      api.setItem(slot, b);
      otherContainer.setItem(otherSlot, a);
    },
    moveItem(fromSlot, toSlot, toContainer) {
      const item = api.getItem(fromSlot);
      api.setItem(fromSlot, undefined);
      toContainer.setItem(toSlot, item);
    },
  };

  return guardUnimplemented(api, "Container") as FakeContainer;
}

export type FakeEntityInventoryComponent = {
  typeId: string;
  container: FakeContainer;
  inventorySize: number;
  containerType: string;
  additionalSlotsPerStrength: number;
  canBeSiphonedFrom: boolean;
  private: boolean;
  restrictToOwner: boolean;
};

export function createEntityInventoryComponent(
  size: number,
  containerType = "inventory"
): FakeEntityInventoryComponent {
  const container = createFakeContainer(size);
  return guardUnimplemented(
    {
      typeId: "minecraft:inventory",
      container,
      inventorySize: size,
      containerType,
      additionalSlotsPerStrength: 0,
      canBeSiphonedFrom: true,
      private: false,
      restrictToOwner: false,
    },
    "EntityInventoryComponent"
  ) as FakeEntityInventoryComponent;
}

/** 对齐 static componentId；`new EntityInventoryComponent()` 硬失败。 */
export const EntityInventoryComponent = Object.assign(
  function EntityInventoryComponentCtor(): never {
    throw new UnimplementedMinecraftApiError("new EntityInventoryComponent()");
  },
  {
    componentId: "minecraft:inventory" as const,
  }
);

export function inventorySizeForEntityType(typeId: string): number | undefined {
  let id = String(typeId ?? "").trim();
  const angle = id.indexOf("<");
  if (angle >= 0) id = id.slice(0, angle);
  if (!id.includes(":")) id = `minecraft:${id}`;
  if (id === "minecraft:player") return 36;
  if (id === "minecraft:chest_minecart" || id === "minecraft:chest_boat") return 27;
  if (id === "minecraft:hopper_minecart") return 5;
  return 27;
}

export function isInventoryComponentId(componentId: string): boolean {
  const id = String(componentId ?? "");
  return (
    id === "minecraft:inventory" ||
    id === "inventory" ||
    id === EntityInventoryComponent.componentId
  );
}
