import { Button, TextInput } from "@sfmc-bds/ui/controls";
/**
 * StudioDialogs.tsx — 浏览器与桌面共用的输入、确认和提示弹窗。
 * Electron 不支持 window.prompt；统一使用异步弹窗并复用编辑器的主题与焦点管理。
 */
import { Modal } from "@sfmc-bds/ui/overlays";
import { useState, useSyncExternalStore } from "react";

interface DialogRequest {
  id: number;
  kind: "prompt" | "confirm" | "alert";
  message: string;
  initialValue: string;
  resolve(value: string | null): void;
}

const queue: DialogRequest[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const snapshot = () => queue[0] ?? null;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};

function request(kind: DialogRequest["kind"], message: string, initialValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    queue.push({ id: nextId++, kind, message, initialValue, resolve });
    notify();
  });
}

export const promptText = (message: string, initialValue = "") => request("prompt", message, initialValue);
export const confirmDialog = async (message: string) => (await request("confirm", message)) !== null;
export const alertDialog = async (message: string) => {
  await request("alert", message);
};

function finish(value: string | null) {
  queue.shift()?.resolve(value);
  notify();
}

function StudioDialog({ entry }: { entry: DialogRequest }) {
  const [value, setValue] = useState(entry.initialValue);
  return (
    <Modal
      open
      onClose={() => finish(null)}
      size="sm"
      title={entry.kind === "prompt" ? "输入" : entry.kind === "confirm" ? "确认操作" : "提示"}
      description={entry.message}
      onSubmit={() => finish(entry.kind === "prompt" ? value : "")}
    >
      {entry.kind === "prompt" && (
        <TextInput
          aria-label={entry.message}
          autoFocus
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={setValue}
        />
      )}
      <div className="modal-actions">
        {entry.kind !== "alert" && (
          <Button type="button" onClick={() => finish(null)}>
            取消
          </Button>
        )}
        <Button variant="primary" type="submit" data-autofocus={entry.kind !== "prompt" ? true : undefined}>
          确定
        </Button>
      </div>
    </Modal>
  );
}

/** 在路由根部挂载一次，切换列表与编辑器时保留弹窗队列。 */
export function StudioDialogHost() {
  const entry = useSyncExternalStore(subscribe, snapshot);
  // 队列推进时重新挂载输入组件，避免上一个弹窗的输入值进入下一次操作。
  return entry ? <StudioDialog key={entry.id} entry={entry} /> : null;
}
