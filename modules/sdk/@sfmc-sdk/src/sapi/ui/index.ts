/**
 * @sfmc-bds/sdk/sapi/ui — SFMC 宿主级声明式 UI 能力。
 *
 * 业务模块直接注册纯 JSON feature，并在自身 lifecycle.cleanup 中注销。
 * 页面动作按 feature.moduleId 使用所属模块的 service 身份执行。
 */

import type { Player } from "@minecraft/server";
import type { UiEntryDefinition } from "../../contracts/ui-document.js";
import type { UiProjectInput } from "../../validation/ui-document.js";
import {
  listDeclarativeEntries,
  openDeclarativeScreen,
  registerDeclarativeFeature,
  unregisterDeclarativeFeature,
} from "./declarative.js";

export {
  ActionForm,
  ModalForm,
  showConfirm,
  showFormWithBusyRetry,
} from "./forms.js";
export type {
  BusyRetryOptions,
  ShowableForm,
} from "./forms.js";

export interface UiOpenScreenRequest {
  moduleId: string;
  screenId: string;
  params?: Record<string, unknown>;
}

export type UiRegisteredEntry = UiEntryDefinition & { moduleId: string };

export interface UiRuntime {
  /** 注册 feature；返回与模块 lifecycle.cleanup 配对的注销函数。 */
  registerFeature(input: UiProjectInput): () => void;
  unregisterFeature(moduleId: string): boolean;
  listEntries(): UiRegisteredEntry[];
  openScreen(player: Player, request: UiOpenScreenRequest): Promise<void>;
}

/** 聚合行为包内唯一的声明式 UI Runtime 门面。 */
export const ui: UiRuntime = {
  registerFeature(input) {
    const result = registerDeclarativeFeature(input);
    if (!result.ok) {
      throw new Error(result.error ?? "声明式 UI feature 注册失败");
    }
    const moduleId = String(
      (input.feature as { moduleId?: unknown } | null)?.moduleId ?? "",
    );
    return () => {
      unregisterDeclarativeFeature(moduleId, input.feature);
    };
  },

  unregisterFeature(moduleId) {
    return unregisterDeclarativeFeature(moduleId).ok;
  },

  listEntries() {
    return listDeclarativeEntries() as unknown as UiRegisteredEntry[];
  },

  openScreen(player, request) {
    return openDeclarativeScreen(
      request.moduleId,
      request.screenId,
      player,
      request.params ?? {},
    );
  },
};
