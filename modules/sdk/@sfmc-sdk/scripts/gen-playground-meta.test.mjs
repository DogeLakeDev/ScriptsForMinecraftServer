import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlaygroundMeta,
  extractClassBody,
  parseClassMembers,
  listHubSignals,
  resolveEventType,
  listHubSignalEntries,
} from "./gen-playground-meta.mjs";

const SAMPLE = `
export class ItemStack {
  amount: number;
  readonly typeId: string;
  clone(): ItemStack;
  setLore(loreList: string[]): void;
}
export class PlayerJoinAfterEvent {
  readonly playerId: string;
  readonly playerName: string;
}
export class PlayerJoinAfterEventSignal {
  private constructor();
  subscribe(callback: (arg0: PlayerJoinAfterEvent) => void): (arg0: PlayerJoinAfterEvent) => void;
}
export class ChatSendBeforeEvent {
  cancel: boolean;
  readonly message: string;
  readonly sender: Player;
}
export class ChatSendBeforeEventSignal {
  subscribe(callback: (arg0: ChatSendBeforeEvent) => void): (arg0: ChatSendBeforeEvent) => void;
}
export class WorldAfterEvents {
  readonly playerJoin: PlayerJoinAfterEventSignal;
  readonly worldLoad: WorldLoadAfterEventSignal;
}
export class WorldBeforeEvents {
  readonly chatSend: ChatSendBeforeEventSignal;
}
export class SystemBeforeEvents {
  readonly startup: StartupBeforeEventSignal;
  readonly shutdown: ShutdownBeforeEventSignal;
}
export class WorldLoadAfterEventSignal {
  subscribe(callback: (arg0: WorldLoadAfterEvent) => void): (arg0: WorldLoadAfterEvent) => void;
}
export class WorldLoadAfterEvent {}
export class StartupBeforeEventSignal {
  subscribe(callback: (arg0: StartupBeforeEvent) => void): (arg0: StartupBeforeEvent) => void;
}
export class StartupBeforeEvent {}
export class ShutdownBeforeEventSignal {
  subscribe(callback: (arg0: ShutdownBeforeEvent) => void): (arg0: ShutdownBeforeEvent) => void;
}
export class ShutdownBeforeEvent {}
`;

test("parseClassMembers 区分 readonly / method", () => {
  const body = extractClassBody(SAMPLE, "ItemStack");
  assert.ok(body);
  const { properties, methods } = parseClassMembers(body);
  assert.equal(properties.find((p) => p.name === "amount")?.readonly, false);
  assert.equal(properties.find((p) => p.name === "typeId")?.readonly, true);
  assert.ok(methods.some((m) => m.name === "clone"));
  assert.ok(methods.some((m) => m.name === "setLore"));
});

test("resolveEventType 从 Signal.subscribe 解析", () => {
  assert.equal(resolveEventType(SAMPLE, "PlayerJoinAfterEventSignal"), "PlayerJoinAfterEvent");
  assert.equal(resolveEventType(SAMPLE, "ChatSendBeforeEventSignal"), "ChatSendBeforeEvent");
});

test("buildPlaygroundMeta 含 Event 类与 eventTypes", () => {
  const meta = buildPlaygroundMeta(SAMPLE);
  assert.ok(meta.classes.ItemStack);
  assert.equal(meta.classes.PlayerJoinAfterEvent?.kind, "event");
  assert.ok(meta.classes.PlayerJoinAfterEvent.properties.some((p) => p.name === "playerName"));
  assert.deepEqual(meta.events["world.afterEvents"], ["playerJoin", "worldLoad"]);
  assert.equal(
    meta.eventTypes["world.afterEvents.playerJoin"].eventType,
    "PlayerJoinAfterEvent"
  );
  assert.equal(meta.eventTypes["world.beforeEvents.chatSend"].eventType, "ChatSendBeforeEvent");
  assert.ok(meta.events["system.beforeEvents"].includes("startup"));
});

test("listHubSignals / listHubSignalEntries", () => {
  const sigs = listHubSignals(SAMPLE, "WorldAfterEvents");
  assert.deepEqual(sigs, ["playerJoin", "worldLoad"]);
  const entries = listHubSignalEntries(SAMPLE, "WorldAfterEvents");
  assert.equal(entries[0].signalType, "PlayerJoinAfterEventSignal");
});
