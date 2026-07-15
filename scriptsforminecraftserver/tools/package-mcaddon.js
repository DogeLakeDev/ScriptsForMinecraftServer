const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { getEnv } = require('./utils');
const cfg = require('../config.json');

const projectName = cfg.projectName;
if (!projectName) {
  console.error('❌ PROJECT_NAME 未设置');
  process.exit(1);
}

const behaviorDir = path.resolve(__dirname, `../behavior_packs/${projectName}`);
const resourceDir = path.resolve(__dirname, `../resource_packs/${projectName}`);
const outputDir = path.resolve(__dirname, '../dist/packages');
const outputFile = path.join(outputDir, `${projectName}.mcaddon`);

async function packageMcaddon() {
  try {
    // 确保输出目录存在
    fs.ensureDirSync(outputDir);

    // 检查行为包和资源包目录是否存在
    if (!fs.existsSync(behaviorDir)) {
      console.error(`❌ 行为包目录不存在: ${behaviorDir}`);
      process.exit(1);
    }

    const zip = new AdmZip();

    // 添加 behavior_packs 文件夹（注意：保持目录结构）
    zip.addLocalFolder(behaviorDir, `behavior_packs/${projectName}`);
    console.log(`📦 已添加 behavior_packs/${projectName}`);

    // 如果资源包存在，也添加
    if (fs.existsSync(resourceDir)) {
      zip.addLocalFolder(resourceDir, `resource_packs/${projectName}`);
      console.log(`📦 已添加 resource_packs/${projectName}`);
    }

    // 写入 .mcaddon 文件
    zip.writeZip(outputFile);
    console.log(`✅ 已打包为 ${outputFile}`);
  } catch (err) {
    console.error('❌ 打包失败:', err.message);
    process.exit(1);
  }
}

packageMcaddon();