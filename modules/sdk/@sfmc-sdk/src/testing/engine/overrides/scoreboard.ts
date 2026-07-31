/**
 * 假 Scoreboard — 对齐 pin 版 @minecraft/server + Learn：
 * getScore 未设分为 undefined；participant 可为 string / Identity / 带 scoreboardIdentity 的实体。
 */

export type FakeScoreboardIdentity = {
  displayName: string;
  id: number;
  isValid: boolean;
  type: "Player" | "Entity" | "FakePlayer";
  getEntity(): unknown | undefined;
};

export type FakeScoreboardScoreInfo = {
  participant: FakeScoreboardIdentity;
  score: number;
};

export type FakeScoreboardObjective = {
  id: string;
  displayName: string;
  isValid: boolean;
  addScore(participant: ScoreParticipant, scoreToAdd: number): number;
  getParticipants(): FakeScoreboardIdentity[];
  getScore(participant: ScoreParticipant): number | undefined;
  getScores(): FakeScoreboardScoreInfo[];
  hasParticipant(participant: ScoreParticipant): boolean;
  removeParticipant(participant: ScoreParticipant): boolean;
  setScore(participant: ScoreParticipant, score: number): void;
};

export type ScoreParticipant = string | FakeScoreboardIdentity | { name?: string; scoreboardIdentity?: FakeScoreboardIdentity };

export type FakeScoreboardObjectiveDisplayOptions = {
  objective: FakeScoreboardObjective;
  sortOrder?: number;
};

export type FakeScoreboard = {
  addObjective(objectiveId: string, displayName?: string): FakeScoreboardObjective;
  getObjective(objectiveId: string): FakeScoreboardObjective | undefined;
  getObjectives(): FakeScoreboardObjective[];
  removeObjective(objectiveId: FakeScoreboardObjective | string): boolean;
  getParticipants(): FakeScoreboardIdentity[];
  clearObjectiveAtDisplaySlot(displaySlotId: string): FakeScoreboardObjective | undefined;
  getObjectiveAtDisplaySlot(displaySlotId: string): FakeScoreboardObjectiveDisplayOptions | undefined;
  setObjectiveAtDisplaySlot(
    displaySlotId: string,
    objectiveDisplaySetting: FakeScoreboardObjectiveDisplayOptions
  ): FakeScoreboardObjective | undefined;
  /** 沙箱内部：登记玩家身份（addPlayer 时调用）。 */
  _registerIdentity(identity: FakeScoreboardIdentity): void;
  reset(): void;
};

let nextIdentityId = 1;

/** 为假玩家/实体创建 ScoreboardIdentity。 */
export function createPlayerScoreboardIdentity(
  player: { name: string },
  getEntity: () => unknown,
  type: FakeScoreboardIdentity["type"] = "Player"
): FakeScoreboardIdentity {
  return {
    displayName: player.name,
    id: nextIdentityId++,
    isValid: true,
    type,
    getEntity,
  };
}

function assertValidObjective(obj: FakeScoreboardObjective): void {
  if (!obj.isValid) {
    throw new Error(`ScoreboardObjective "${obj.id}" is no longer valid`);
  }
}

function resolveParticipantKey(participant: ScoreParticipant): string {
  if (typeof participant === "string") return participant;
  if (participant && typeof participant === "object") {
    const asIdentity = participant as FakeScoreboardIdentity;
    // 先用 in 探测，避免 FakePlayer 全表面代理对缺失字段硬失败
    if (
      "displayName" in asIdentity &&
      typeof asIdentity.displayName === "string" &&
      typeof asIdentity.id === "number" &&
      "type" in asIdentity
    ) {
      return asIdentity.displayName;
    }
    const entity = participant as { scoreboardIdentity?: FakeScoreboardIdentity; name?: string };
    if (entity.scoreboardIdentity?.displayName) return entity.scoreboardIdentity.displayName;
    if (typeof entity.name === "string") return entity.name;
  }
  throw new Error("Invalid scoreboard participant");
}

function resolveIdentity(
  participant: ScoreParticipant,
  identities: Map<string, FakeScoreboardIdentity>
): FakeScoreboardIdentity {
  const key = resolveParticipantKey(participant);
  const existing = identities.get(key);
  if (existing) return existing;
  if (typeof participant === "object" && participant && "displayName" in participant && "id" in participant) {
    const id = participant as FakeScoreboardIdentity;
    identities.set(key, id);
    return id;
  }
  const fake: FakeScoreboardIdentity = {
    displayName: key,
    id: nextIdentityId++,
    isValid: true,
    type: "FakePlayer",
    getEntity: () => undefined,
  };
  identities.set(key, fake);
  return fake;
}

export function createFakeScoreboard(): FakeScoreboard {
  const objectives = new Map<string, FakeScoreboardObjective>();
  /** objectiveId → participantKey → score */
  const scores = new Map<string, Map<string, number>>();
  const identities = new Map<string, FakeScoreboardIdentity>();
  const displaySlots = new Map<string, FakeScoreboardObjectiveDisplayOptions>();

  const makeObjective = (id: string, displayName: string): FakeScoreboardObjective => {
    if (!scores.has(id)) scores.set(id, new Map());
    const table = scores.get(id)!;

    const objective: FakeScoreboardObjective = {
      id,
      displayName,
      isValid: true,
      addScore(participant, scoreToAdd) {
        assertValidObjective(objective);
        const key = resolveParticipantKey(participant);
        resolveIdentity(participant, identities);
        const next = (table.get(key) ?? 0) + scoreToAdd;
        table.set(key, next);
        return next;
      },
      getParticipants() {
        assertValidObjective(objective);
        return [...table.keys()].map((k) => identities.get(k)!).filter(Boolean);
      },
      getScore(participant) {
        assertValidObjective(objective);
        const key = resolveParticipantKey(participant);
        return table.has(key) ? table.get(key) : undefined;
      },
      getScores() {
        assertValidObjective(objective);
        return [...table.entries()].map(([k, score]) => ({
          participant: identities.get(k)!,
          score,
        }));
      },
      hasParticipant(participant) {
        assertValidObjective(objective);
        return table.has(resolveParticipantKey(participant));
      },
      removeParticipant(participant) {
        assertValidObjective(objective);
        const key = resolveParticipantKey(participant);
        return table.delete(key);
      },
      setScore(participant, score) {
        assertValidObjective(objective);
        const key = resolveParticipantKey(participant);
        resolveIdentity(participant, identities);
        table.set(key, score);
      },
    };
    return objective;
  };

  const api: FakeScoreboard = {
    addObjective(objectiveId, displayName) {
      if (objectives.has(objectiveId)) {
        throw new Error(`Objective "${objectiveId}" already exists`);
      }
      const obj = makeObjective(objectiveId, displayName ?? objectiveId);
      objectives.set(objectiveId, obj);
      return obj;
    },
    getObjective(objectiveId) {
      return objectives.get(objectiveId);
    },
    getObjectives() {
      return [...objectives.values()];
    },
    removeObjective(objectiveId) {
      const id = typeof objectiveId === "string" ? objectiveId : objectiveId.id;
      const obj = objectives.get(id);
      if (!obj) return false;
      obj.isValid = false;
      objectives.delete(id);
      scores.delete(id);
      for (const [slot, opts] of [...displaySlots.entries()]) {
        if (opts.objective.id === id) displaySlots.delete(slot);
      }
      return true;
    },
    getParticipants() {
      return [...identities.values()];
    },
    clearObjectiveAtDisplaySlot(displaySlotId) {
      const prev = displaySlots.get(displaySlotId);
      displaySlots.delete(displaySlotId);
      return prev?.objective;
    },
    getObjectiveAtDisplaySlot(displaySlotId) {
      return displaySlots.get(displaySlotId);
    },
    setObjectiveAtDisplaySlot(displaySlotId, objectiveDisplaySetting) {
      const prev = displaySlots.get(displaySlotId);
      displaySlots.set(displaySlotId, objectiveDisplaySetting);
      return prev?.objective;
    },
    _registerIdentity(identity) {
      identities.set(identity.displayName, identity);
    },
    reset() {
      for (const o of objectives.values()) o.isValid = false;
      objectives.clear();
      scores.clear();
      identities.clear();
      displaySlots.clear();
      nextIdentityId = 1;
    },
  };

  return api;
}
