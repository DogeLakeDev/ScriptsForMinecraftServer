/**
 * 动态属性薄 Map 袋 — Entity / Player / World 共用。
 * 支持类型对齐 pin .d.ts：boolean | number | string | Vector3；undefined/null 删除键。
 * 不模拟容量上限 / 序列化字节精确值。
 */

export type FakeDynamicPropertyValue = boolean | number | string | { x: number; y: number; z: number };

export type FakeDynamicPropertyBagMethods = {
  clearDynamicProperties(): void;
  getDynamicProperty(identifier: string): FakeDynamicPropertyValue | undefined;
  getDynamicPropertyIds(): string[];
  getDynamicPropertyTotalByteCount(): number;
  setDynamicProperty(identifier: string, value?: FakeDynamicPropertyValue | null): void;
  setDynamicProperties(
    values: Record<string, FakeDynamicPropertyValue | undefined | null>
  ): void;
};

function estimateByteCount(key: string, value: unknown): number {
  let n = key.length;
  if (typeof value === "string") n += value.length;
  else if (typeof value === "number" || typeof value === "boolean") n += 8;
  else if (value && typeof value === "object") n += 24; // Vector3 粗估
  return n;
}

/**
 * @param isValid 缺省视为始终有效（World）；Entity/Player 传入 isValid 门。
 */
export function createDynamicPropertyBagMethods(
  isValid?: () => boolean
): FakeDynamicPropertyBagMethods {
  const bag = new Map<string, FakeDynamicPropertyValue>();

  function assertValid(): void {
    if (isValid && !isValid()) throw new Error("InvalidEntityError");
  }

  const api: FakeDynamicPropertyBagMethods = {
    clearDynamicProperties() {
      assertValid();
      bag.clear();
    },
    getDynamicProperty(identifier) {
      assertValid();
      return bag.get(String(identifier));
    },
    getDynamicPropertyIds() {
      assertValid();
      return [...bag.keys()];
    },
    getDynamicPropertyTotalByteCount() {
      assertValid();
      let n = 0;
      for (const [k, v] of bag) n += estimateByteCount(k, v);
      return n;
    },
    setDynamicProperty(identifier, value) {
      assertValid();
      const key = String(identifier);
      if (value === undefined || value === null) bag.delete(key);
      else bag.set(key, value as FakeDynamicPropertyValue);
    },
    setDynamicProperties(values) {
      assertValid();
      for (const [k, v] of Object.entries(values ?? {})) {
        api.setDynamicProperty(k, v);
      }
    },
  };
  return api;
}
