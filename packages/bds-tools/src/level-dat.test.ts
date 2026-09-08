import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  enableBetaApisInLevelDat,
  parseBedrockLevelDat,
  readLevelDatExperiments,
  TAG_BYTE,
  TAG_COMPOUND,
  TAG_END,
} from "./level-dat.js";

function buildMockLevelDat(includeExperiments: boolean, gametestVal?: number): Buffer {
  const rootName = "";
  const rootNameBuf = Buffer.from(rootName, "utf8");

  const childBuffers: Buffer[] = [];

  // Random sample tag
  const sampleName = Buffer.from("LevelName", "utf8");
  const sampleVal = Buffer.from("TestWorld", "utf8");
  const strTag = Buffer.alloc(1 + 2 + sampleName.length + 2 + sampleVal.length);
  strTag.writeUInt8(8, 0); // TAG_String
  strTag.writeUInt16LE(sampleName.length, 1);
  sampleName.copy(strTag, 3);
  strTag.writeUInt16LE(sampleVal.length, 3 + sampleName.length);
  sampleVal.copy(strTag, 5 + sampleName.length);
  childBuffers.push(strTag);

  if (includeExperiments) {
    const expName = Buffer.from("experiments", "utf8");
    const expChildren: Buffer[] = [];

    // experiments_ever_used = 0
    const everUsedName = Buffer.from("experiments_ever_used", "utf8");
    const b1 = Buffer.alloc(1 + 2 + everUsedName.length + 1);
    b1.writeUInt8(TAG_BYTE, 0);
    b1.writeUInt16LE(everUsedName.length, 1);
    everUsedName.copy(b1, 3);
    b1.writeInt8(0, 3 + everUsedName.length);
    expChildren.push(b1);

    if (gametestVal !== undefined) {
      const gtName = Buffer.from("gametest", "utf8");
      const b2 = Buffer.alloc(1 + 2 + gtName.length + 1);
      b2.writeUInt8(TAG_BYTE, 0);
      b2.writeUInt16LE(gtName.length, 1);
      gtName.copy(b2, 3);
      b2.writeInt8(gametestVal, 3 + gtName.length);
      expChildren.push(b2);
    }

    expChildren.push(Buffer.from([TAG_END]));

    const expHeader = Buffer.alloc(1 + 2 + expName.length);
    expHeader.writeUInt8(TAG_COMPOUND, 0);
    expHeader.writeUInt16LE(expName.length, 1);
    expName.copy(expHeader, 3);

    childBuffers.push(Buffer.concat([expHeader, ...expChildren]));
  }

  childBuffers.push(Buffer.from([TAG_END]));

  const rootHeader = Buffer.alloc(1 + 2 + rootNameBuf.length);
  rootHeader.writeUInt8(TAG_COMPOUND, 0);
  rootHeader.writeUInt16LE(rootNameBuf.length, 1);
  rootNameBuf.copy(rootHeader, 3);

  const nbtBody = Buffer.concat([rootHeader, ...childBuffers]);

  const fileHeader = Buffer.alloc(8);
  fileHeader.writeUInt32LE(10, 0); // version 10
  fileHeader.writeUInt32LE(nbtBody.length, 4);

  return Buffer.concat([fileHeader, nbtBody]);
}

test("readLevelDatExperiments: correctly reads experiments status", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-lvl-test-"));
  try {
    const file = path.join(tmpDir, "level.dat");

    // 1. Without gametest
    fs.writeFileSync(file, buildMockLevelDat(true));
    const info1 = readLevelDatExperiments(file);
    assert.ok(info1);
    assert.equal(info1.hasBetaApis, false);
    assert.equal(info1.experimentsEverUsed, false);

    // 2. With gametest = 1
    fs.writeFileSync(file, buildMockLevelDat(true, 1));
    const info2 = readLevelDatExperiments(file);
    assert.ok(info2);
    assert.equal(info2.hasBetaApis, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("enableBetaApisInLevelDat: enables gametest and updates header length", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-lvl-test-"));
  try {
    const file = path.join(tmpDir, "level.dat");
    fs.writeFileSync(file, buildMockLevelDat(true));

    const res1 = await enableBetaApisInLevelDat(file);
    assert.equal(res1.success, true);
    assert.equal(res1.changed, true);
    assert.ok(res1.backupPath && fs.existsSync(res1.backupPath));

    // Check after change
    const info = readLevelDatExperiments(file);
    assert.ok(info);
    assert.equal(info.hasBetaApis, true);
    assert.equal(info.experimentsEverUsed, true);
    assert.equal(info.savedWithToggledExperiments, true);

    // Verify header length matches buffer length
    const finalBuf = fs.readFileSync(file);
    const parsed = parseBedrockLevelDat(finalBuf);
    assert.equal(parsed.dataLength, finalBuf.length - 8);

    // Idempotency test: second run shouldn't change
    const res2 = await enableBetaApisInLevelDat(file);
    assert.equal(res2.success, true);
    assert.equal(res2.changed, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("enableBetaApisInLevelDat: creates experiments compound if completely absent", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-lvl-test-"));
  try {
    const file = path.join(tmpDir, "level.dat");
    fs.writeFileSync(file, buildMockLevelDat(false));

    const res = await enableBetaApisInLevelDat(file);
    assert.equal(res.success, true);
    assert.equal(res.changed, true);

    const info = readLevelDatExperiments(file);
    assert.ok(info);
    assert.equal(info.hasBetaApis, true);
    assert.equal(info.experimentsEverUsed, true);
    assert.equal(info.savedWithToggledExperiments, true);

    const finalBuf = fs.readFileSync(file);
    const parsed = parseBedrockLevelDat(finalBuf);
    assert.equal(parsed.dataLength, finalBuf.length - 8);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
