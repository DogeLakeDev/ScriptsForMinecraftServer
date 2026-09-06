import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { copyDirSync, copyFileSyncSafe, getDirSize, rmSafe } from "./fsx.js";

describe("fsx: copyDirSync & copyFileSyncSafe", () => {
  it("copyDirSync 自动忽略 .git / node_modules 等元数据", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-fsx-test-"));
    try {
      const src = path.join(tmp, "src");
      const dest = path.join(tmp, "dest");
      fs.mkdirSync(path.join(src, ".git", "objects"), { recursive: true });
      fs.mkdirSync(path.join(src, "scripts"), { recursive: true });
      fs.writeFileSync(path.join(src, ".git", "HEAD"), "ref: refs/heads/main\n");
      fs.writeFileSync(path.join(src, "scripts", "main.js"), "console.log('hello');\n");
      fs.writeFileSync(path.join(src, ".DS_Store"), "junk");

      copyDirSync(src, dest);

      assert.ok(fs.existsSync(path.join(dest, "scripts", "main.js")));
      assert.ok(!fs.existsSync(path.join(dest, ".git")));
      assert.ok(!fs.existsSync(path.join(dest, ".DS_Store")));
    } finally {
      rmSafe(tmp);
    }
  });

  it("copyFileSyncSafe 能够安全覆写 Windows 平台下的只读只读属性文件", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-fsx-ro-"));
    try {
      const src = path.join(tmp, "src.txt");
      const dest = path.join(tmp, "dest.txt");
      fs.writeFileSync(src, "version 2");
      fs.writeFileSync(dest, "version 1");
      // 设置目标文件只读 (Windows 0444)
      fs.chmodSync(dest, 0o444);

      // copyFileSyncSafe 应当捕获 EPERM 并覆写成功，而不是崩溃
      copyFileSyncSafe(src, dest);

      assert.equal(fs.readFileSync(dest, "utf8"), "version 2");

      // 再次覆写，确保不会遗留只读阻断下一次备份
      fs.writeFileSync(src, "version 3");
      copyFileSyncSafe(src, dest);
      assert.equal(fs.readFileSync(dest, "utf8"), "version 3");
    } finally {
      try {
        fs.chmodSync(path.join(tmp, "dest.txt"), 0o666);
      } catch {}
      rmSafe(tmp);
    }
  });

  it("getDirSize 忽略 .git 目录大小", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-fsx-size-"));
    try {
      fs.mkdirSync(path.join(tmp, ".git"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".git", "pack"), "x".repeat(10000));
      fs.writeFileSync(path.join(tmp, "data.txt"), "hello");

      const size = getDirSize(tmp);
      assert.equal(size, 5);
    } finally {
      rmSafe(tmp);
    }
  });
});
