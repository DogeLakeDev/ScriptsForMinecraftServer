/**
 * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。
 * L0：可 import；未实现成员硬失败。
 */
import { UnimplementedMinecraftApiError } from "../allowlist.js";

function l0Class(apiPath: string) {
  return class {
    constructor(..._args: unknown[]) {
      return new Proxy(this, {
        get(target: object, prop: string | symbol, receiver: unknown) {
          if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
          if (prop === 'then') return undefined;
          if (prop === 'constructor') return Reflect.get(target, prop, receiver);
          throw new UnimplementedMinecraftApiError(`${apiPath}.${String(prop)}`);
        },
      });
    }
  };
}

export const ActionFormResponse = l0Class("ActionFormResponse");

export const FormRejectError = l0Class("FormRejectError");

export const FormRejectReason = {
  "MalformedResponse": "MalformedResponse",
  "PlayerQuit": "PlayerQuit",
  "ServerShutdown": "ServerShutdown"
};

export const FormResponse = l0Class("FormResponse");

export const FormVisibilityError = l0Class("FormVisibilityError");

export const FormVisibilityErrorReason = {
  "AlreadyShowing": "AlreadyShowing",
  "NotShowing": "NotShowing"
};

export const InvalidFormError = l0Class("InvalidFormError");

export const InvalidFormModificationError = l0Class("InvalidFormModificationError");

export const InvalidObservableError = l0Class("InvalidObservableError");

export const MessageFormResponse = l0Class("MessageFormResponse");

export const ModalFormResponse = l0Class("ModalFormResponse");

export const PlayerLeftError = l0Class("PlayerLeftError");

export const TextFilteringError = {
  "DisabledByPlayer": "DisabledByPlayer",
  "TextProcessorServiceUnreachable": "TextProcessorServiceUnreachable",
  "Unknown": "Unknown"
};

export const UIManager = l0Class("UIManager");

export const __sfmcL0ExportNames = ["ActionFormResponse","FormRejectError","FormRejectReason","FormResponse","FormVisibilityError","FormVisibilityErrorReason","InvalidFormError","InvalidFormModificationError","InvalidObservableError","MessageFormResponse","ModalFormResponse","PlayerLeftError","TextFilteringError","UIManager"];
