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

/** 短标签（列表 / i18n 共用；新源只改此处 — OCP） */
export function providerShortLabel(id: PackProviderId): string {
  switch (id) {
    case "curseforge":
      return "cf";
    default: {
      const _exhaustive: never = id;
      return String(_exhaustive);
    }
  }
}

/**
 * 解析已配置完备的源。
 * - 指定 id：只检查该源
 * - 未指定：按 providers 键顺序取第一个 isConfigured() 的源（入口勿再写死 curseforge — OCP/LSP）
 */
export function resolveConfiguredPackProvider(
  cfg: PackUpdateConfig,
  id?: PackProviderId
): PackSourceProvider | null {
  const candidates: PackProviderId[] = id
    ? [id]
    : (Object.keys(cfg.providers) as PackProviderId[]);
  for (const pid of candidates) {
    if (!(pid in cfg.providers)) continue;
    const provider = createPackSourceProvider(cfg, pid);
    if (provider.isConfigured()) return provider;
  }
  return null;
}

export { CurseForgeBedrockProvider };
