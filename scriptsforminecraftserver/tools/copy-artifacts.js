/* ---------------------------------------- *\
 *  Description :  复制构建产物dist到目标目录 *
 *  Version     :  1.0.0                    *
\* ---------------------------------------- */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "path";
import config from "../config.json" with { type: "json" };
import { ensureDir } from "./utils.js";
const { existsSync, copyFileSync } = fs;
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const projectName = config.projectName;
if (!projectName) {
  console.error("❌ PROJECT_NAME 未设置，请在 ../config.json 中配置");
  process.exit(1);
}

// 源文件：dist/scripts/main.js
const srcFile = resolve(__dirname, "../dist/scripts/main.js");
// 如果 sourcemap 存在，也一并复制
const srcMap = resolve(__dirname, "../dist/debug/main.js.map");
// 目标：behavior_packs/${PROJECT_NAME}/scripts/main.js
const behaviorTarget = resolve(__dirname, `../behavior_packs/${projectName}/scripts/main.js`);

async function copyArtifacts() {
  try {
    if (!existsSync(srcFile)) {
      console.error("❌ 源文件不存在，请先运行 build 或直接运行 bundle");
      process.exit(1);
    }

    // 确保目标目录存在
    ensureDir(dirname(behaviorTarget));

    // 复制到 behavior_packs
    copyFileSync(srcFile, behaviorTarget, fs.constants.COPYFILE_FICLONE);
    console.log(`✅ 已复制到 ${behaviorTarget}`);

    // 如果 sourcemap 存在，也复制
    if (existsSync(srcMap)) {
      const behaviorMap = resolve(__dirname, `../behavior_packs/${projectName}/scripts/main.js.map`);
      copyFileSync(srcMap, behaviorMap, fs.constants.COPYFILE_FICLONE);
      console.log(`✅ 已复制 sourcemap`);
    }
  } catch (err) {
    console.error("复制失败:", err.message);
    process.exit(1);
  }
}

copyArtifacts();
