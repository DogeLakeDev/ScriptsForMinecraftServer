/* ---------------------------------------- *\
 *  Description : 部署到游戏资源包目录        *
 *  Version     :  1.0.0                    *
\* ---------------------------------------- */

const path = require('path');
const fs = require('fs-extra');
const { getEnv } = require('./utils');
const cfg = require('../config.json');

const projectName = cfg.projectName;
const deployPath = cfg.deployPath;
if (!projectName || !deployPath) {
  console.error('❌ 请确保 ../config 中设置了 PROJECT_NAME 和 MC_PATH');
  process.exit(1);
}

// 源目录
const devBehavior = path.resolve(__dirname, `../behavior_packs/${projectName}`);
const devResource = path.resolve(__dirname, `../resource_packs/${projectName}`);

// 目标目录
const prodBehavior = path.join(deployPath, 'behavior_packs', projectName);
const prodResource = path.join(deployPath, 'resource_packs', projectName);
//const prodBehavior = path.join(deployPath, 'development_behavior_packs', projectName);
//const prodResource = path.join(deployPath, 'development_resource_packs', projectName);

async function deploy() {
  try {
    if (!fs.existsSync(devBehavior)) {
      console.warn(`⚠️ 源目录不存在: ${devBehavior}，跳过部署`);
      return;
    }
    if (!fs.existsSync(devResource)) {
      console.warn(`⚠️ 源目录不存在: ${devResource}，跳过部署`);
      return;
    }

    fs.copySync(devBehavior, prodBehavior, { overwrite: true, recursive: true });
    fs.copySync(devResource, prodResource, { overwrite: true, recursive: true });
    console.log(`✅ 已同步到 ${prodBehavior}`);
    console.log(`✅ 已同步到 ${prodResource}`);
  } catch (err) {
    console.error('❌ 部署失败:', err.message);
    process.exit(1);
  }
}

deploy();