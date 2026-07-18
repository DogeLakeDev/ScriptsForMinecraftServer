/* ---------------------------------------- *\
 *  Description :  构建工作流工具     *
 *  Version     :  1.0.0                    *
\* ---------------------------------------- */
import path from "path";
import fs from "node:fs";
const { existsSync, mkdirSync } = fs;

// 从 .env 或 process.env 读取环境变量
export function getEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.warn(` 环境变量 ${key} 未设置，使用默认值`);
    return "";
  }
  return val;
}

// 确保目录存在
export function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
