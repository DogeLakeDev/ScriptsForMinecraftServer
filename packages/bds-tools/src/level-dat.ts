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
  nameOffset: number;  // 标签名称起始 offset
  valueOffset: number; // 载荷起始 offset
  endOffset: number;   // 标签结束绝对 offset
  value?: unknown;
}

export interface LevelDatExperimentsInfo {
  experimentsEverUsed: boolean;
  savedWithToggledExperiments: boolean;
  experiments: Record<string, number | boolean>;
  hasBetaApis: boolean;
}

export interface LevelDatMutateResult {
  success: boolean;
  changed: boolean;
  backupPath?: string;
  error?: string;
  previousBetaApisState?: boolean;
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

    return {
      experimentsEverUsed,
      savedWithToggledExperiments,
      experiments,
      hasBetaApis,
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
 * 为指定 level.dat 开启 Beta APIs（gametest）。
 *
 * 保证：
 * - 自动备份原文件至 `${levelDatPath}.bak`；
 * - 自动更新 experiments 复合标签中的 gametest = 1b；
 * - 自动更新 experiments_ever_used = 1b 与 saved_with_toggled_experiments = 1b；
 * - 精确校准 8 字节文件头部的 dataLength；
 * - 原子写操作（.tmp -> rename）；
 * - 若已处于开启状态，直接返回 changed: false，不破坏文件。
 */
export async function enableBetaApisInLevelDat(levelDatPath: string): Promise<LevelDatMutateResult> {
  if (!fs.existsSync(levelDatPath)) {
    return { success: false, changed: false, error: `File not found: ${levelDatPath}` };
  }

  try {
    const raw = await fs.promises.readFile(levelDatPath);
    const parsed = parseBedrockLevelDat(raw);

    const expCompoundTag = parsed.rootChildren.get("experiments");
    let currentBetaState = false;

    if (expCompoundTag && expCompoundTag.type === TAG_COMPOUND) {
      const expChildren = parseCompoundChildren(raw, expCompoundTag.valueOffset).children;
      const gametest = expChildren.get("gametest");
      if (gametest && Number(gametest.value) === 1) {
        currentBetaState = true;
      }
    }

    if (currentBetaState) {
      return {
        success: true,
        changed: false,
        previousBetaApisState: true,
      };
    }

    // 需要进行备份
    const backupPath = `${levelDatPath}.bak`;
    await fs.promises.copyFile(levelDatPath, backupPath);

    let nbtBody: Buffer;

    if (!expCompoundTag) {
      // 场景 1：完全缺失 experiments compound，在根 compound 结束标签前追加完整 experiments compound
      const insertCompoundBuf = createCompoundTagBuffer("experiments", {
        experiments_ever_used: 1,
        saved_with_toggled_experiments: 1,
        gametest: 1,
      });

      // 根标签结束点在 parsed.rootEndOffset - 1（TAG_END 字节所在位置）
      const rootEndTagIndex = parsed.rootEndOffset - 1;
      const beforeEnd = raw.subarray(8, rootEndTagIndex);
      const afterEnd = raw.subarray(rootEndTagIndex); // 包含 TAG_END 及后续（若有）
      nbtBody = Buffer.concat([beforeEnd, insertCompoundBuf, afterEnd]);
    } else {
      // 场景 2：已有 experiments compound，在 experiments compound 内部更新或插入缺失字段
      const { children: expChildren, compoundEndOffset: expEndOffset } = parseCompoundChildren(
        raw,
        expCompoundTag.valueOffset
      );
      const expEndTagIndex = expEndOffset - 1; // 内部 TAG_END 所在绝对索引

      // 组装要在 experiments 内部追加的 tag（若不存在）
      const toAppend: Buffer[] = [];
      let mutatedRaw = Buffer.from(raw);

      // 处理 gametest
      const gametestTag = expChildren.get("gametest");
      if (gametestTag) {
        mutatedRaw.writeInt8(1, gametestTag.valueOffset);
      } else {
        toAppend.push(createByteTagBuffer("gametest", 1));
      }

      // 处理 experiments_ever_used
      const everUsedTag = expChildren.get("experiments_ever_used");
      if (everUsedTag) {
        mutatedRaw.writeInt8(1, everUsedTag.valueOffset);
      } else {
        toAppend.push(createByteTagBuffer("experiments_ever_used", 1));
      }

      // 处理 saved_with_toggled_experiments
      const savedTag = expChildren.get("saved_with_toggled_experiments");
      if (savedTag) {
        mutatedRaw.writeInt8(1, savedTag.valueOffset);
      } else {
        toAppend.push(createByteTagBuffer("saved_with_toggled_experiments", 1));
      }

      // 也把 root 层的 experiments_ever_used 设为 1（若存在）
      const rootEverUsed = parsed.rootChildren.get("experiments_ever_used");
      if (rootEverUsed) {
        mutatedRaw.writeInt8(1, rootEverUsed.valueOffset);
      }
      const rootSaved = parsed.rootChildren.get("saved_with_toggled_experiments");
      if (rootSaved) {
        mutatedRaw.writeInt8(1, rootSaved.valueOffset);
      }

      if (toAppend.length > 0) {
        const beforeExpEnd = mutatedRaw.subarray(8, expEndTagIndex);
        const afterExpEnd = mutatedRaw.subarray(expEndTagIndex);
        nbtBody = Buffer.concat([beforeExpEnd, ...toAppend, afterExpEnd]);
      } else {
        nbtBody = mutatedRaw.subarray(8);
      }
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
      previousBetaApisState: false,
    };
  } catch (err) {
    return {
      success: false,
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
