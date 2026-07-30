/**
 * @minecraft/server-ui 桥：手写 L2 + L0 生成大范围导出。
 */

import { UnimplementedMinecraftApiError } from "./allowlist.js";
import * as L0 from "./generated/server-ui-l0.js";
import {
  ActionFormData,
  MessageFormData,
  ModalFormData,
  CustomForm,
  MessageBox,
  FormCancelationReason,
  DataDrivenScreenClosedReason,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
  ObservableUIRawMessage,
  uiManager,
} from "./ui.js";

export {
  ActionFormData,
  MessageFormData,
  ModalFormData,
  CustomForm,
  MessageBox,
  FormCancelationReason,
  DataDrivenScreenClosedReason,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
  ObservableUIRawMessage,
  uiManager,
};

export * from "./generated/server-ui-l0.js";

const hand: Record<string | symbol, unknown> = {
  ActionFormData,
  MessageFormData,
  ModalFormData,
  CustomForm,
  MessageBox,
  FormCancelationReason,
  DataDrivenScreenClosedReason,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
  ObservableUIRawMessage,
  uiManager,
};

export default new Proxy(hand, {
  get(t, prop) {
    if (prop === "__esModule") return true;
    if (typeof prop === "symbol") return undefined;
    if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
    const fromL0 = (L0 as Record<string, unknown>)[prop];
    if (fromL0 !== undefined) return fromL0;
    throw new UnimplementedMinecraftApiError(`@minecraft/server-ui.${String(prop)}`);
  },
  has(t, prop) {
    if (typeof prop === "symbol") return false;
    return Object.prototype.hasOwnProperty.call(t, prop) || prop in (L0 as object);
  },
});
