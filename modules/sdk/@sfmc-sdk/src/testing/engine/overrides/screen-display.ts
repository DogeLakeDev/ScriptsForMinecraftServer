/**
 * 假 ScreenDisplay — 标题 / 副标题 / 动作栏可断言；其余 HUD API 仍 L0 硬失败。
 */

import { guardUnimplemented } from "../unimplemented-error.js";

function displayText(text: unknown): string {
  if (typeof text === "string") return text;
  if (Array.isArray(text)) return text.map(displayText).join("");
  if (text && typeof text === "object") {
    try {
      return JSON.stringify(text);
    } catch {
      return String(text);
    }
  }
  return String(text ?? "");
}

export type FakeScreenDisplay = {
  readonly isValid: boolean;
  /** 沙箱可观测：最近一次 setTitle */
  title: string;
  /** 沙箱可观测：副标题（setTitle options 或 updateSubtitle） */
  subtitle: string;
  /** 沙箱可观测：动作栏 */
  actionBar: string;
  setActionBar(text: unknown): void;
  setTitle(title: unknown, options?: { subtitle?: unknown }): void;
  updateSubtitle(subtitle: unknown): void;
};

export function createFakeScreenDisplay(isOwnerValid: () => boolean): FakeScreenDisplay {
  const api: FakeScreenDisplay = {
    get isValid() {
      return isOwnerValid();
    },
    title: "",
    subtitle: "",
    actionBar: "",
    setActionBar(text) {
      if (!isOwnerValid()) throw new Error("InvalidEntityError");
      api.actionBar = displayText(text);
    },
    setTitle(title, options) {
      if (!isOwnerValid()) throw new Error("InvalidEntityError");
      api.title = displayText(title);
      if (options && "subtitle" in options) {
        api.subtitle = displayText(options.subtitle);
      }
    },
    updateSubtitle(subtitle) {
      if (!isOwnerValid()) throw new Error("InvalidEntityError");
      api.subtitle = displayText(subtitle);
    },
  };
  return guardUnimplemented(api, "ScreenDisplay") as FakeScreenDisplay;
}
