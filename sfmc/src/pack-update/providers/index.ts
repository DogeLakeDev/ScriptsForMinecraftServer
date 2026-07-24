/**
 * 源提供者注册表：按配置构造 PackSourceProvider（OCP：新源加分支/注册，不改编排层）。
 */
import type { PackSourceProvider, PackUpdateConfig } from "../types.js";
import { CurseForgeBedrockProvider } from "./curseforge.js";

export function createPackSourceProvider(cfg: PackUpdateConfig): PackSourceProvider {
  /* 当前仅 curseforge；后续源在此扩展，service 只依赖 PackSourceProvider */
  return new CurseForgeBedrockProvider(cfg.providers.curseforge);
}

export { CurseForgeBedrockProvider };
