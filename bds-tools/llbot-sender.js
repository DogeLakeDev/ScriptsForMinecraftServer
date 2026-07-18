/**
 * llbot-sender.js — shim, 委托给 src/qqutil.ts 编译产物
 *
 * 保留兼容性: 外部工具仍然 require("./llbot-sender") 即可拿到
 *   { sendText, sendMixed, sendWithImage }
 */

const path = require("node:path");
const dist = require(path.join(__dirname, "dist", "qqutil.js"));

module.exports = {
  sendText: dist.sendText,
  sendMixed: dist.sendMixed,
  sendWithImage: dist.sendWithImage,
};
