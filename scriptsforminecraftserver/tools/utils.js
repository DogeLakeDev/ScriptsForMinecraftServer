/* ---------------------------------------- *\
 *  Description :  构建工作流工具     *
 *  Version     :  1.0.0                    *
\* ---------------------------------------- */
const path = require("path");
const fs = require("fs-extra");

// 从 .env 或 process.env 读取环境变量
function getEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.warn(` 环境变量 ${key} 未设置，使用默认值`);
    return "";
  }
  return val;
}

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { getEnv, ensureDir };
