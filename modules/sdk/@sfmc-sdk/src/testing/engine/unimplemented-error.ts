/**
 * 假引擎未实现 API 硬失败（全表面：无 allowlist 裁剪）。
 */

export class UnimplementedMinecraftApiError extends Error {
  constructor(apiPath: string) {
    super(
      `sfmc-testing: 未实现的 Minecraft API「${apiPath}」。` +
        `该符号可 import，但沙箱尚未接线语义；请缩小用例或等待 L2/L3 加深。`
    );
    this.name = "UnimplementedMinecraftApiError";
  }
}

/**
 * 对实例做全表面代理：已实现成员可访问，其余属性访问抛硬失败（禁止安静 undefined）。
 */
export function guardUnimplemented<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);
      if (prop === "then") return undefined; /* 避免被当成 Thenable */
      if (prop in obj) return Reflect.get(obj, prop, receiver);
      throw new UnimplementedMinecraftApiError(`${path}.${prop}`);
    },
  });
}
