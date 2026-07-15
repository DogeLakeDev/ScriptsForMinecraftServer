/* ---------------------------------------- *\
 *  Description :  复制构建产物dist到目标目录 *
 *  Version     :  1.0.0                    *
\* ---------------------------------------- */

const path = require('path');
const fs = require('fs-extra');
const { getEnv, ensureDir } = require('./utils');
const cfg = require('../config.json');

const projectName = cfg.projectName;
if (!projectName) {
  console.error('❌ PROJECT_NAME 未设置，请在 ../config.json 中配置');
  process.exit(1);
}

// 源文件：dist/scripts/main.js
const srcFile = path.resolve(__dirname, '../dist/scripts/main.js');
// 如果 sourcemap 存在，也一并复制
const srcMap = path.resolve(__dirname, '../dist/debug/main.js.map');
// 目标：behavior_packs/${PROJECT_NAME}/scripts/main.js
const behaviorTarget = path.resolve(__dirname, `../behavior_packs/${projectName}/scripts/main.js`);

async function copyArtifacts() {
  try {
    if (!fs.existsSync(srcFile)) {
      console.error('❌ 源文件不存在，请先运行 build 或直接运行 bundle');
      process.exit(1);
    }

    // 确保目标目录存在
    ensureDir(path.dirname(behaviorTarget));

    // 复制到 behavior_packs
    fs.copySync(srcFile, behaviorTarget, { overwrite: true });
    console.log(`✅ 已复制到 ${behaviorTarget}`);

    // 如果 sourcemap 存在，也复制
    if (fs.existsSync(srcMap)) {
      const behaviorMap = path.resolve(__dirname, `../behavior_packs/${projectName}/scripts/main.js.map`);
      fs.copySync(srcMap, behaviorMap, { overwrite: true });
      console.log(`✅ 已复制 sourcemap`);
    }
  } catch (err) {
    console.error('复制失败:', err.message);
    process.exit(1);
  }
}

copyArtifacts();