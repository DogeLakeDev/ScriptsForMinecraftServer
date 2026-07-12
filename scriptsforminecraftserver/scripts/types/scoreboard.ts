import { ScoreboardIdentityType } from "@minecraft/server";

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  participants?: Participant[];
}

export interface Participant {
  id: number;
  type: ScoreboardIdentityType;
  name: string;
  score: number;
}
