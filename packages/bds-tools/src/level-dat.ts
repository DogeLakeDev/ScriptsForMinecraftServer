/**
 * level-dat.ts — Minecraft 基岩版世界存档 level.dat 小端序 NBT 解析与实验性玩法安全修改器
 *
 * 基岩版 level.dat 规范：
 * - Header（8 字节）：
 *   - [0..3] uint32 LE：存储格式版本（当前版本通常为 10）
 *   - [4..7] uint32 LE：有效 NBT 数据字节长度（data_length）
 * - Payload：未压缩的小端序（Little-Endian）标准 NBT 复合标签（TAG_Compound）
 *
 * 核心能力：
 * - 原生无外部黑盒依赖，Buffer 级解析与精确字节位移
 * - 读取世界实验性玩法的开启状态（特别是 Beta APIs / gametest）
 * - 安全注入或切换实验性开关并自动备份原文件（.bak）与校准 Header data_length
 */

import fs from "node:fs";

export const TAG_END = 0;
export const TAG_BYTE = 1;
export const TAG_SHORT = 2;
export const TAG_INT = 3;
export const TAG_LONG = 4;
export const TAG_FLOAT = 5;
export const TAG_DOUBLE = 6;
export const TAG_BYTE_ARRAY = 7;
export const TAG_STRING = 8;
export const TAG_LIST = 9;
export const TAG_COMPOUND = 10;
export const TAG_INT_ARRAY = 11;
export const TAG_LONG_ARRAY = 12;

export interface NbtTagMeta {
  type: number;
  name: string;
  startOffset: number; // 包含 tagType 的起始绝对 offset
  nameOffset: number; // 标签名称起始 offset
  valueOffset: number; // 载荷起始 offset
  endOffset: number; // 标签结束绝对 offset
  value?: unknown;
}

export interface KnownExperimentDefinition {
  id: string;
  nbtKey: string;
  nameZh: string;
  nameEn: string;
  aliases?: string[];
  isRootTag?: boolean;
  extraExpTags?: string[];
}

export const KNOWN_EXPERIMENTS: readonly KnownExperimentDefinition[] = [
  {
    id: "gametest",
    nbtKey: "gametest",
    nameZh: "测试版 API",
    nameEn: "Beta APIs (gametest)",
    aliases: ["beta", "beta_apis", "betapis", "gametest"],
  },
  {
    id: "upcoming_creator_features",
    nbtKey: "upcoming_creator_features",
    nameZh: "即将推出的创作者功能",
    nameEn: "Upcoming Creator Features",
    aliases: ["upcoming", "creator_features", "upcoming_features"],
  },
  {
    id: "experimental_creator_cameras",
    nbtKey: "experimental_creator_cameras",
    nameZh: "创建者照相机的实验性功能",
    nameEn: "Experimental Creator Cameras",
    aliases: ["camera", "cameras", "creator_cameras", "creator_camera"],
  },
  {
    id: "voxel_shapes",
    nbtKey: "voxel_shapes",
    nameZh: "实验性Voxel形状特征",
    nameEn: "Experimental Voxel Shapes",
    aliases: ["voxel", "voxel_shape", "experimental_voxel_shapes", "voxelshapes"],
  },
  {
    id: "villager_trades_rebalance",
    nbtKey: "villager_trades_rebalance",
    nameZh: "村民贸易再平衡",
    nameEn: "Villager Trade Rebalance",
    aliases: ["villager", "trades", "villager_trades", "trade_rebalance"],
  },
  {
    id: "drop_3_2026",
    nbtKey: "drop_3_2026",
    nameZh: "2026年第3次更新",
    nameEn: "Drop 3 of 2026",
    aliases: [
      "drop3",
      "drop_3",
      "drop_3_2026",
      "wilderness",
      "wilderness_bound",
      "update_2026_drop_3",
      "update_26_3",
      "update_drop_3",
    ],
    extraExpTags: ["update_2026_drop_3"],
  },
  {
    id: "education",
    nbtKey: "educationFeaturesEnabled",
    nameZh: "Minecraft Education 功能",
    nameEn: "Minecraft Education Features",
    isRootTag: true,
    aliases: ["edu", "education", "education_edition", "educationfeatures"],
    extraExpTags: ["education"],
  },
] as const;

export function resolveExperimentDefinition(query: string): KnownExperimentDefinition | null {
  const q = query.trim().toLowerCase().replace(/[-_]/g, "");
  for (const def of KNOWN_EXPERIMENTS) {
    if (def.id.replace(/[-_]/g, "") === q) return def;
    if (def.nbtKey.replace(/[-_]/g, "") === q) return def;
    if (def.aliases) {
      for (const a of def.aliases) {
        if (a.replace(/[-_]/g, "") === q) return def;
      }
    }
  }
  return null;
}

export interface LevelDatExperimentsInfo {
  experimentsEverUsed: boolean;
  savedWithToggledExperiments: boolean;
  experiments: Record<string, number | boolean>;
  hasBetaApis: boolean;
  knownExperiments: Record<string, boolean>;
}

export interface LevelDatMutateResult {
  success: boolean;
  changed: boolean;
  backupPath?: string;
  error?: string;
  previousBetaApisState?: boolean;
  enabledExperiments?: string[];
}

/**
 * 遍历并跳过指定类型的 NBT 载荷，返回下一个 tag 的 offset。
 */
export function skipNbtPayload(buf: Buffer, offset: number, type: number): number {
  switch (type) {
    case TAG_BYTE:
      return offset + 1;
    case TAG_SHORT:
      return offset + 2;
    case TAG_INT:
    case TAG_FLOAT:
      return offset + 4;
    case TAG_LONG:
    case TAG_DOUBLE:
      return offset + 8;
    case TAG_BYTE_ARRAY: {
      if (offset + 4 > buf.length) throw new Error("Unexpected EOF reading TAG_Byte_Array length");
      const len = buf.readInt32LE(offset);
      return offset + 4 + Math.max(0, len);
    }
    case TAG_STRING: {
      if (offset + 2 > buf.length) throw new Error("Unexpected EOF reading TAG_String length");
      const len = buf.readUInt16LE(offset);
      return offset + 2 + len;
    }
    case TAG_LIST: {
      if (offset + 5 > buf.length) throw new Error("Unexpected EOF reading TAG_List header");
      const elemType = buf.readUInt8(offset);
      const count = buf.readInt32LE(offset + 1);
      let cur = offset + 5;
      for (let i = 0; i < count; i++) {
        cur = skipNbtPayload(buf, cur, elemType);
      }
      return cur;
    }
    case TAG_COMPOUND: {
      let cur = offset;
      while (cur < buf.length) {
        const t = buf.readUInt8(cur);
        if (t === TAG_END) {
          return cur + 1;
        }
        if (cur + 3 > buf.length) throw new Error("Unexpected EOF reading compound child header");
        const nameLen = buf.readUInt16LE(cur + 1);
        const childValOffset = cur + 3 + nameLen;
        cur = skipNbtPayload(buf, childValOffset, t);
      }
      return cur;
    }
    case TAG_INT_ARRAY: {
      if (offset + 4 > buf.length) throw new Error("Unexpected EOF reading TAG_Int_Array length");
      const len = buf.readInt32LE(offset);
      return offset + 4 + Math.max(0, len) * 4;
    }
    case TAG_LONG_ARRAY: {
      if (offset + 4 > buf.length) throw new Error("Unexpected EOF reading TAG_Long_Array length");
      const len = buf.readInt32LE(offset);
      return offset + 4 + Math.max(0, len) * 8;
    }
    default:
      throw new Error(`Unsupported or unknown NBT tag type: ${type} at offset ${offset}`);
  }
}

/**
 * 解析复合标签内部所有直接子标签的元数据映射。
 */
export function parseCompoundChildren(
  buf: Buffer,
  compoundValueOffset: number
): { children: Map<string, NbtTagMeta>; compoundEndOffset: number } {
  const children = new Map<string, NbtTagMeta>();
  let cur = compoundValueOffset;

  while (cur < buf.length) {
    const tagType = buf.readUInt8(cur);
    if (tagType === TAG_END) {
      return { children, compoundEndOffset: cur + 1 };
    }
    if (cur + 3 > buf.length) {
      throw new Error(`Unexpected EOF reading named tag header at offset ${cur}`);
    }
    const nameLen = buf.readUInt16LE(cur + 1);
    const nameOffset = cur + 3;
    if (nameOffset + nameLen > buf.length) {
      throw new Error(`Unexpected EOF reading tag name at offset ${cur}`);
    }
    const name = buf.toString("utf8", nameOffset, nameOffset + nameLen);
    const valOffset = nameOffset + nameLen;
    const endOffset = skipNbtPayload(buf, valOffset, tagType);

    let val: unknown = undefined;
    if (tagType === TAG_BYTE) {
      val = buf.readInt8(valOffset);
    } else if (tagType === TAG_INT) {
      val = buf.readInt32LE(valOffset);
    } else if (tagType === TAG_STRING) {
      const sLen = buf.readUInt16LE(valOffset);
      val = buf.toString("utf8", valOffset + 2, valOffset + 2 + sLen);
    }

    children.set(name, {
      type: tagType,
      name,
      startOffset: cur,
      nameOffset,
      valueOffset: valOffset,
      endOffset,
      value: val,
    });

    cur = endOffset;
  }

  return { children, compoundEndOffset: cur };
}

/**
 * 解析基岩版 level.dat 的完整文件结构并定位根 Compound。
 */
export function parseBedrockLevelDat(buf: Buffer): {
  version: number;
  dataLength: number;
  rootCompoundName: string;
  rootChildren: Map<string, NbtTagMeta>;
  rootEndOffset: number;
} {
  if (buf.length < 8) {
    throw new Error("Invalid level.dat: buffer smaller than 8-byte header");
  }
  const version = buf.readUInt32LE(0);
  const dataLength = buf.readUInt32LE(4);

  // 根标签必须是 TAG_Compound
  if (buf.length < 9 || buf.readUInt8(8) !== TAG_COMPOUND) {
    throw new Error("Invalid level.dat: root tag is not TAG_Compound");
  }
  const rootNameLen = buf.readUInt16LE(9);
  const rootCompoundName = buf.toString("utf8", 11, 11 + rootNameLen);
  const rootValueOffset = 11 + rootNameLen;

  const { children: rootChildren, compoundEndOffset: rootEndOffset } = parseCompoundChildren(buf, rootValueOffset);

  return {
    version,
    dataLength,
    rootCompoundName,
    rootChildren,
    rootEndOffset,
  };
}

/**
 * 读取世界存档 level.dat 的实验性配置。若解析失败或文件不存在返回 null。
 */
export function readLevelDatExperiments(levelDatPath: string): LevelDatExperimentsInfo | null {
  if (!fs.existsSync(levelDatPath)) return null;
  try {
    const buf = fs.readFileSync(levelDatPath);
    const parsed = parseBedrockLevelDat(buf);

    let experimentsEverUsed = false;
    const everUsedTag = parsed.rootChildren.get("experiments_ever_used");
    if (everUsedTag && everUsedTag.type === TAG_BYTE && Number(everUsedTag.value) === 1) {
      experimentsEverUsed = true;
    }

    let savedWithToggledExperiments = false;
    const savedTag = parsed.rootChildren.get("saved_with_toggled_experiments");
    if (savedTag && savedTag.type === TAG_BYTE && Number(savedTag.value) === 1) {
      savedWithToggledExperiments = true;
    }

    const experiments: Record<string, number | boolean> = {};
    let hasBetaApis = false;

    const expCompoundTag = parsed.rootChildren.get("experiments");
    if (expCompoundTag && expCompoundTag.type === TAG_COMPOUND) {
      const expChildren = parseCompoundChildren(buf, expCompoundTag.valueOffset).children;

      // 部分版本 experiments_ever_used 也可能位于 experiments 内部
      const innerEverUsed = expChildren.get("experiments_ever_used");
      if (innerEverUsed && Number(innerEverUsed.value) === 1) {
        experimentsEverUsed = true;
      }
      const innerSaved = expChildren.get("saved_with_toggled_experiments");
      if (innerSaved && Number(innerSaved.value) === 1) {
        savedWithToggledExperiments = true;
      }

      for (const [name, meta] of expChildren.entries()) {
        if (meta.type === TAG_BYTE) {
          const num = Number(meta.value);
          experiments[name] = num;
          if (name === "gametest" && num === 1) {
            hasBetaApis = true;
          }
        }
      }
    }

    const knownExperiments: Record<string, boolean> = {};
    for (const def of KNOWN_EXPERIMENTS) {
      let enabled = false;
      if (def.isRootTag) {
        const rootTag = parsed.rootChildren.get(def.nbtKey);
        if (rootTag && Number(rootTag.value) === 1) {
          enabled = true;
        }
      }
      const keysToCheck = [def.nbtKey, ...(def.aliases ?? [])];
      for (const k of keysToCheck) {
        if (experiments[k] === 1) {
          enabled = true;
          break;
        }
      }
      knownExperiments[def.id] = enabled;
    }

    return {
      experimentsEverUsed,
      savedWithToggledExperiments,
      experiments,
      hasBetaApis,
      knownExperiments,
    };
  } catch {
    return null;
  }
}

/**
 * 构造一个 TAG_Byte 的二进制 Buffer。
 */
function createByteTagBuffer(name: string, value: number): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const buf = Buffer.alloc(1 + 2 + nameBuf.length + 1);
  buf.writeUInt8(TAG_BYTE, 0);
  buf.writeUInt16LE(nameBuf.length, 1);
  nameBuf.copy(buf, 3);
  buf.writeInt8(value, 3 + nameBuf.length);
  return buf;
}

/**
 * 构造一个包含指定键值对的 TAG_Compound Buffer。
 */
function createCompoundTagBuffer(name: string, byteTags: Record<string, number>): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const childBuffers: Buffer[] = [];
  for (const [k, v] of Object.entries(byteTags)) {
    childBuffers.push(createByteTagBuffer(k, v));
  }
  childBuffers.push(Buffer.from([TAG_END]));

  const header = Buffer.alloc(1 + 2 + nameBuf.length);
  header.writeUInt8(TAG_COMPOUND, 0);
  header.writeUInt16LE(nameBuf.length, 1);
  nameBuf.copy(header, 3);

  return Buffer.concat([header, ...childBuffers]);
}

/**
 * 为指定 level.dat 开启指定的实验性开关（若未指定或传 "all" 则开启全部已知实验性开关）。
 *
 * 保证：
 * - 自动备份原文件至 `${levelDatPath}.bak`；
 * - 自动更新 root 与 experiments 复合标签中的目标 byte tags；
 * - 自动更新 experiments_ever_used = 1b 与 saved_with_toggled_experiments = 1b；
 * - 精确校准 8 字节文件头部的 dataLength；
 * - 原子写操作（.tmp -> rename）；
 * - 若所请求开关已全部处于开启状态，直接返回 changed: false，不破坏文件。
 */
export async function enableExperimentsInLevelDat(
  levelDatPath: string,
  targetExperimentIds?: string[] | "all"
): Promise<LevelDatMutateResult> {
  if (!fs.existsSync(levelDatPath)) {
    return { success: false, changed: false, error: `File not found: ${levelDatPath}` };
  }

  try {
    const raw = await fs.promises.readFile(levelDatPath);
    const parsed = parseBedrockLevelDat(raw);

    // 解析目标实验项
    let targetDefs: KnownExperimentDefinition[] = [];
    if (!targetExperimentIds || targetExperimentIds === "all") {
      targetDefs = [...KNOWN_EXPERIMENTS];
    } else {
      const seen = new Set<string>();
      for (const id of targetExperimentIds) {
        const def = resolveExperimentDefinition(id);
        if (def && !seen.has(def.id)) {
          seen.add(def.id);
          targetDefs.push(def);
        }
      }
      if (targetDefs.length === 0) {
        return { success: true, changed: false, enabledExperiments: [] };
      }
    }

    const expCompoundTag = parsed.rootChildren.get("experiments");
    const existingExpChildren =
      expCompoundTag && expCompoundTag.type === TAG_COMPOUND
        ? parseCompoundChildren(raw, expCompoundTag.valueOffset).children
        : new Map<string, NbtTagMeta>();

    // 检查当前状态
    let needsChange = false;
    const enabledIds: string[] = [];

    // 1. 检查 experiments compound 及内部必要系统标签
    if (!expCompoundTag) {
      needsChange = true;
    } else {
      const expEverUsed = existingExpChildren.get("experiments_ever_used");
      if (!expEverUsed || Number(expEverUsed.value) !== 1) needsChange = true;

      const expSaved = existingExpChildren.get("saved_with_toggled_experiments");
      if (!expSaved || Number(expSaved.value) !== 1) needsChange = true;
    }

    // 若 root 层存在系统标签但未设为 1，也需修正
    const rootEverUsed = parsed.rootChildren.get("experiments_ever_used");
    if (rootEverUsed && Number(rootEverUsed.value) !== 1) needsChange = true;

    const rootSaved = parsed.rootChildren.get("saved_with_toggled_experiments");
    if (rootSaved && Number(rootSaved.value) !== 1) needsChange = true;

    let previousBetaApisState = false;
    const currentGametest = existingExpChildren.get("gametest");
    if (currentGametest && Number(currentGametest.value) === 1) {
      previousBetaApisState = true;
    }

    for (const def of targetDefs) {
      enabledIds.push(def.id);
      if (def.isRootTag) {
        const rootTag = parsed.rootChildren.get(def.nbtKey);
        if (!rootTag || Number(rootTag.value) !== 1) {
          needsChange = true;
        }
      }
      if (!def.isRootTag) {
        const tag = existingExpChildren.get(def.nbtKey);
        if (!tag || Number(tag.value) !== 1) {
          needsChange = true;
        }
      }
      if (def.extraExpTags) {
        for (const extra of def.extraExpTags) {
          const tag = existingExpChildren.get(extra);
          if (!tag || Number(tag.value) !== 1) {
            needsChange = true;
          }
        }
      }
    }

    if (!needsChange) {
      return {
        success: true,
        changed: false,
        previousBetaApisState,
        enabledExperiments: enabledIds,
      };
    }

    // 备份原文件
    const backupPath = `${levelDatPath}.bak`;
    await fs.promises.copyFile(levelDatPath, backupPath);

    let mutatedRaw = Buffer.from(raw);
    let nbtBody: Buffer;

    // 收集需要在 experiments 复合标签中设置的 tags
    const requiredExpTags: Record<string, number> = {
      experiments_ever_used: 1,
      saved_with_toggled_experiments: 1,
    };
    for (const def of targetDefs) {
      if (!def.isRootTag) {
        requiredExpTags[def.nbtKey] = 1;
      }
      if (def.extraExpTags) {
        for (const extra of def.extraExpTags) {
          requiredExpTags[extra] = 1;
        }
      }
    }

    // 收集 root 层需要更新或插入的 tags
    const rootNeedsEducation = targetDefs.some((d) => d.id === "education");

    // 更新 root 层已存在的相关 tags
    if (rootEverUsed) {
      mutatedRaw.writeInt8(1, rootEverUsed.valueOffset);
    }
    if (rootSaved) {
      mutatedRaw.writeInt8(1, rootSaved.valueOffset);
    }
    if (rootNeedsEducation) {
      const eduTag = parsed.rootChildren.get("educationFeaturesEnabled");
      if (eduTag) {
        mutatedRaw.writeInt8(1, eduTag.valueOffset);
      }
      const optOut = parsed.rootChildren.get("has_opted_out_of_education");
      if (optOut) {
        mutatedRaw.writeInt8(0, optOut.valueOffset);
      }
    }

    const rootTagsToAppend: Buffer[] = [];
    if (rootNeedsEducation && !parsed.rootChildren.has("educationFeaturesEnabled")) {
      rootTagsToAppend.push(createByteTagBuffer("educationFeaturesEnabled", 1));
    }

    if (!expCompoundTag) {
      // 场景 1：完全缺失 experiments compound
      const newExpCompoundBuf = createCompoundTagBuffer("experiments", requiredExpTags);
      const rootEndTagIndex = parsed.rootEndOffset - 1;
      const beforeEnd = mutatedRaw.subarray(8, rootEndTagIndex);
      const afterEnd = mutatedRaw.subarray(rootEndTagIndex);
      nbtBody = Buffer.concat([beforeEnd, ...rootTagsToAppend, newExpCompoundBuf, afterEnd]);
    } else {
      // 场景 2：已有 experiments compound
      const { compoundEndOffset: expEndOffset } = parseCompoundChildren(raw, expCompoundTag.valueOffset);
      const expEndTagIndex = expEndOffset - 1;
      const rootEndTagIndex = parsed.rootEndOffset - 1;

      const expTagsToAppend: Buffer[] = [];
      for (const [name, val] of Object.entries(requiredExpTags)) {
        const existing = existingExpChildren.get(name);
        if (existing) {
          mutatedRaw.writeInt8(val, existing.valueOffset);
        } else {
          expTagsToAppend.push(createByteTagBuffer(name, val));
        }
      }

      // 组装新 NBT body
      // Part 1: root 开始到 experiments TAG_END 前
      const part1 = mutatedRaw.subarray(8, expEndTagIndex);
      // Part 2: 追加到 experiments 内部的 tags
      const part2 = Buffer.concat(expTagsToAppend);
      // Part 3: experiments TAG_END 到 root TAG_END 前
      const part3 = mutatedRaw.subarray(expEndTagIndex, rootEndTagIndex);
      // Part 4: 追加到 root 层的 tags (如 educationFeaturesEnabled)
      const part4 = Buffer.concat(rootTagsToAppend);
      // Part 5: root TAG_END 及后续
      const part5 = mutatedRaw.subarray(rootEndTagIndex);

      nbtBody = Buffer.concat([part1, part2, part3, part4, part5]);
    }

    // 重新构造 8 字节 header
    const newHeader = Buffer.alloc(8);
    newHeader.writeUInt32LE(parsed.version, 0);
    newHeader.writeUInt32LE(nbtBody.length, 4);

    const finalFileBuffer = Buffer.concat([newHeader, nbtBody]);

    // 原子替换
    const tmpFile = `${levelDatPath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmpFile, finalFileBuffer);
    await fs.promises.rename(tmpFile, levelDatPath);

    return {
      success: true,
      changed: true,
      backupPath,
      previousBetaApisState,
      enabledExperiments: enabledIds,
    };
  } catch (err) {
    return {
      success: false,
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 为指定 level.dat 开启 Beta APIs（gametest）。
 * 保持向后兼容，委托给 enableExperimentsInLevelDat。
 */
export async function enableBetaApisInLevelDat(levelDatPath: string): Promise<LevelDatMutateResult> {
  return await enableExperimentsInLevelDat(levelDatPath, ["gametest"]);
}
