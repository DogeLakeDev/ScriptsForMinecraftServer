export interface WorldData {
  allowCheats: boolean;
  gameRules: string;
  seed: string;
  defaultSpawnLocation: string;
  difficulty: string;

  day: number;
  tickingAreasCount: number;
  absoluteTime: number; // tick (day*24000+daytime)
  structuresFromAddon: string;
  structuresFromWorld: string;
  dynamicPropertyTotalByteCount: number;
  // Gets the total byte count of dynamic properties. This could potentially be used for your own analytics to ensure you're not storing gigantic sets of dynamic properties.
  MoonPhase: number; // 月相 🔎冷知识：在最亮的月相阶段，猫有 50% 的几率生成黑猫;)

  updatedAt: string;
}
