/**
 * UI 响应队列（与 ActionFormData 共用 getEngine().ui）。
 */

import type { FakePlayer } from "./player.js";

export type FormResponse = {
  canceled?: boolean;
  selection?: number;
  formValues?: unknown[];
  cancelationReason?: string;
  /** CustomForm / MessageBox：DataDrivenScreenClosedReason */
  closeReason?: string;
};

type QueueKey = string;

function keyOf(player: FakePlayer | { id?: string; name?: string }): QueueKey {
  return String((player as FakePlayer).id ?? (player as { name?: string }).name ?? "unknown");
}

export type FakeUiHost = {
  queueResponse(player: FakePlayer | { id?: string; name?: string }, response: FormResponse): void;
  takeResponse(player: FakePlayer | { id?: string; name?: string }): FormResponse;
  clearPlayer(player: FakePlayer | { id?: string; name?: string }): void;
  reset(): void;
};

export function createFakeUiHost(): FakeUiHost {
  const queues = new Map<QueueKey, FormResponse[]>();
  return {
    queueResponse(player, response) {
      const k = keyOf(player);
      const q = queues.get(k) ?? [];
      q.push(response);
      queues.set(k, q);
    },
    takeResponse(player) {
      const k = keyOf(player);
      const q = queues.get(k);
      if (!q || q.length === 0) {
        return { canceled: true, cancelationReason: "UserClosed" };
      }
      return q.shift()!;
    },
    clearPlayer(player) {
      queues.delete(keyOf(player));
    },
    reset() {
      queues.clear();
    },
  };
}
