/**
 * Holoprint NBT Parser — Minecraft Bedrock .mcstructure 文件解析器
 *
 * 实现一个轻量级的 NBT (Named Binary Tag) 解析器，
 * 支持 Minecraft Bedrock 的 .mcstructure 格式。
 *
 * NBT 二进制格式参考:
 *   - 每个命名标签: [tag_type(1B)] [name_length(2B, BE)] [name_bytes] [payload]
 *   - TAG_List:      [element_tag_type(1B)] [length(4B, BE)] [payloads...]
 *   - TAG_Compound:  [named_tags...] [TAG_End(0x00)]
 *   - 所有多字节整数均为大端序 (Big-Endian)
 */

// ---------- 工具函数 ----------

function readInt8(buffer, offset) {
  return { value: buffer.readInt8(offset), offset: offset + 1 };
}

function readUInt8(buffer, offset) {
  return { value: buffer.readUInt8(offset), offset: offset + 1 };
}

function readInt16(buffer, offset) {
  return { value: buffer.readInt16BE(offset), offset: offset + 2 };
}

function readUInt16(buffer, offset) {
  return { value: buffer.readUInt16BE(offset), offset: offset + 2 };
}

function readInt32(buffer, offset) {
  return { value: buffer.readInt32BE(offset), offset: offset + 4 };
}

function readInt64(buffer, offset) {
  // JavaScript 的 Number 可以安全表示 -(2^53-1) 到 (2^53-1) 范围的整数
  // 对于完全的 64 位支持，这里使用 BigInt 会更好，但为了简单，使用两个 32 位拼接
  const high = buffer.readInt32BE(offset);
  const low = buffer.readUInt32BE(offset + 4);
  const value = high * 0x100000000 + low;
  return { value, offset: offset + 8 };
}

function readFloat32(buffer, offset) {
  return { value: buffer.readFloatBE(offset), offset: offset + 4 };
}

function readFloat64(buffer, offset) {
  return { value: buffer.readDoubleBE(offset), offset: offset + 8 };
}

function readUTF8(buffer, offset, length) {
  const value = buffer.toString('utf8', offset, offset + length);
  return { value, offset: offset + length };
}

// ---------- NBT 标签类型 ----------

const TAG_END = 0x00;
const TAG_BYTE = 0x01;
const TAG_SHORT = 0x02;
const TAG_INT = 0x03;
const TAG_LONG = 0x04;
const TAG_FLOAT = 0x05;
const TAG_DOUBLE = 0x06;
const TAG_BYTE_ARRAY = 0x07;
const TAG_STRING = 0x08;
const TAG_LIST = 0x09;
const TAG_COMPOUND = 0x0A;
const TAG_INT_ARRAY = 0x0B;
const TAG_LONG_ARRAY = 0x0C;

// ---------- 标签名称映射 (用于调试) ----------

const TAG_NAMES = {
  [TAG_END]: 'TAG_End',
  [TAG_BYTE]: 'TAG_Byte',
  [TAG_SHORT]: 'TAG_Short',
  [TAG_INT]: 'TAG_Int',
  [TAG_LONG]: 'TAG_Long',
  [TAG_FLOAT]: 'TAG_Float',
  [TAG_DOUBLE]: 'TAG_Double',
  [TAG_BYTE_ARRAY]: 'TAG_Byte_Array',
  [TAG_STRING]: 'TAG_String',
  [TAG_LIST]: 'TAG_List',
  [TAG_COMPOUND]: 'TAG_Compound',
  [TAG_INT_ARRAY]: 'TAG_Int_Array',
  [TAG_LONG_ARRAY]: 'TAG_Long_Array',
};

// ---------- 解析器核心 ----------

/**
 * 解析一个命名标签 (type + name + payload)
 */
function parseNamedTag(buffer, offset) {
  const { value: tagType, offset: off1 } = readUInt8(buffer, offset);

  if (tagType === TAG_END) {
    return { type: TAG_END, name: '', value: null, offset: off1 };
  }

  const { value: nameLength, offset: off2 } = readUInt16(buffer, off1);
  const { value: name, offset: off3 } = readUTF8(buffer, off2, nameLength);
  const { value, offset: off4 } = parseTagPayload(buffer, off3, tagType);

  return { type: tagType, name, value, offset: off4 };
}

/**
 * 根据标签类型解析 payload
 */
function parseTagPayload(buffer, offset, tagType) {
  switch (tagType) {
    case TAG_BYTE: {
      const { value, offset: newOff } = readInt8(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_SHORT: {
      const { value, offset: newOff } = readInt16(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_INT: {
      const { value, offset: newOff } = readInt32(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_LONG: {
      const { value, offset: newOff } = readInt64(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_FLOAT: {
      const { value, offset: newOff } = readFloat32(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_DOUBLE: {
      const { value, offset: newOff } = readFloat64(buffer, offset);
      return { value, offset: newOff };
    }
    case TAG_BYTE_ARRAY: {
      const { value: length, offset: off1 } = readInt32(buffer, offset);
      const bytes = Buffer.alloc(length);
      buffer.copy(bytes, 0, off1, off1 + length);
      return { value: bytes, offset: off1 + length };
    }
    case TAG_STRING: {
      const { value: length, offset: off1 } = readUInt16(buffer, offset);
      return readUTF8(buffer, off1, length);
    }
    case TAG_LIST: {
      const { value: elementType, offset: off1 } = readUInt8(buffer, offset);
      const { value: length, offset: off2 } = readInt32(buffer, off1);
      const items = [];
      let currentOffset = off2;
      for (let i = 0; i < length; i++) {
        const { value, offset: newOff } = parseTagPayload(buffer, currentOffset, elementType);
        items.push(value);
        currentOffset = newOff;
      }
      return { value: { type: elementType, items }, offset: currentOffset };
    }
    case TAG_COMPOUND: {
      const fields = {};
      let currentOffset = offset;
      while (true) {
        const result = parseNamedTag(buffer, currentOffset);
        currentOffset = result.offset;
        if (result.type === TAG_END) break;
        fields[result.name] = { type: result.type, value: result.value };
      }
      return { value: fields, offset: currentOffset };
    }
    case TAG_INT_ARRAY: {
      const { value: length, offset: off1 } = readInt32(buffer, offset);
      const ints = [];
      let currentOffset = off1;
      for (let i = 0; i < length; i++) {
        const { value, offset: newOff } = readInt32(buffer, currentOffset);
        ints.push(value);
        currentOffset = newOff;
      }
      return { value: ints, offset: currentOffset };
    }
    case TAG_LONG_ARRAY: {
      const { value: length, offset: off1 } = readInt32(buffer, offset);
      const longs = [];
      let currentOffset = off1;
      for (let i = 0; i < length; i++) {
        const { value, offset: newOff } = readInt64(buffer, currentOffset);
        longs.push(value);
        currentOffset = newOff;
      }
      return { value: longs, offset: currentOffset };
    }
    default:
      throw new Error(`未知的 NBT 标签类型: 0x${tagType.toString(16)} 在偏移量 ${offset}`);
  }
}

// ---------- .mcstructure 格式特定解析器 ----------

/**
 * 从解析后的 NBT 结构中提取 mcstructure 数据
 */
function extractMcStructure(nbt) {
  // mcstructure 文件的根是一个 TAG_Compound，
  // 里面可能直接包含 size/palette/blocks，也可能包含一个子 compound 叫 "structure"
  let root = nbt;

  // 如果根 compound 包含一个名为 "structure" 的子 compound，则使用它
  if (root.value && root.value.structure && root.value.structure.type === TAG_COMPOUND) {
    root = root.value.structure;
  }

  const structure = root.value || root;

  // --- 解析 size (int[3]) ---
  let sizeX = 0, sizeY = 0, sizeZ = 0;
  if (structure.size) {
    const sizeArr = structure.size.value;
    sizeX = sizeArr[0] || 0;
    sizeY = sizeArr[1] || 0;
    sizeZ = sizeArr[2] || 0;
  }

  // --- 解析 palette (list of compounds) ---
  const palette = [];
  if (structure.palette && structure.palette.value && structure.palette.value.items) {
    for (const item of structure.palette.value.items) {
      // 每个 palette 条目是一个 compound
      let name = 'minecraft:air';
      let states = {};

      if (item.name !== undefined) {
        name = item.name.value || 'minecraft:air';
      }
      if (item.states && item.states.value) {
        // 将 states compound 转换为普通对象
        states = {};
        for (const [key, field] of Object.entries(item.states.value)) {
          states[key] = field.value;
        }
      }

      palette.push({ name, states });
    }
  }

  // --- 解析 blocks (list of compounds) ---
  const blocks = [];
  if (structure.blocks && structure.blocks.value && structure.blocks.value.items) {
    for (const item of structure.blocks.value.items) {
      // 每个 block 条目是一个 compound，包含 pos (int[3]) 和 palette (int)
      let pos = [0, 0, 0];
      let paletteIndex = 0;

      if (item.pos && item.pos.value) {
        pos = item.pos.value;
      }
      if (item.palette !== undefined) {
        paletteIndex = item.palette.value;
      }

      blocks.push({
        x: pos[0],
        y: pos[1],
        z: pos[2],
        palette_index: paletteIndex,
      });
    }
  }

  // --- 解析 block_entities (list of compounds) ---
  const blockEntities = [];
  if (structure.block_entities && structure.block_entities.value && structure.block_entities.value.items) {
    for (const item of structure.block_entities.value.items) {
      const entity = {};
      // Convert compound to plain object
      if (typeof item === 'object' && item !== null) {
        for (const [key, field] of Object.entries(item)) {
          if (field && typeof field === 'object' && 'value' in field) {
            entity[key] = field.value;
          }
        }
      }
      blockEntities.push(entity);
    }
  }

  return {
    size: { x: sizeX, y: sizeY, z: sizeZ },
    palette,
    blocks,
    block_entities: blockEntities,
  };
}

/**
 * 解析 .mcstructure 文件的 Buffer
 * @param {Buffer} buffer - 完整的 .mcstructure 文件内容
 * @returns {Object} 解析后的结构数据
 */
function parseMcStructure(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('输入必须是 Buffer');
  }

  if (buffer.length < 2) {
    throw new Error('文件过短，无法解析');
  }

  // 解析根 TAG_Compound
  const root = parseNamedTag(buffer, 0);

  if (!root || root.type !== TAG_COMPOUND) {
    throw new Error('无效的 .mcstructure 文件: 根标签不是 TAG_Compound');
  }

  return extractMcStructure(root);
}

module.exports = { parseMcStructure };
