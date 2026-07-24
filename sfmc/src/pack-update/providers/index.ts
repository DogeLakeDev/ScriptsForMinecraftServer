/**
 * 源提供者注册表：按 id 构造 PackSourceProvider（OCP：新源加 case，不改编排层）。
 */
import type { PackProviderId, PackSourceProvider, PackUpdateConfig } from "../types.js";
import { CurseForgeBedrockProvider } from "./curseforge.js";

export function createPackSourceProvider(
  cfg: PackUpdateConfig,
  id: PackProviderId = "curseforge"
): PackSourceProvider {
  switch (id) {
    case "curseforge":
      return new CurseForgeBedrockProvider(cfg.providers.curseforge);
    default: {
      const _exhaustive: never = id;
      throw new Error(`未知 pack 源提供者: ${String(_exhaustive)}`);
    }
  }
}

export { CurseForgeBedrockProvider };
