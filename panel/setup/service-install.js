/**
 * setup/service-install.js — 服务路径与依赖检测
 *
 * 检查 BDS / QQ-Bridge / LLBot / DB-Server 路径是否存在，
 * 给出"建议的安装步骤"。
 */
import fs from 'node:fs';
import path from 'node:path';

export function detectServiceStatus(payload) {
  const status = {};
  const bds = payload.paths?.bdsPath || payload.bds?.path;
  if (bds) {
    const exe = path.join(bds, 'bedrock_server.exe');
    status.bds = {
      ok: fs.existsSync(exe),
      path: bds,
      exe,
      hint: fs.existsSync(exe) ? 'BDS 可执行文件存在' : `需要把 bedrock_server.exe 放到 ${bds}`,
    };
  }
  const llbotPath = payload.paths?.llbotPath || payload.qq?.llbot_path;
  if (llbotPath) {
    status.llbot = {
      ok: fs.existsSync(llbotPath),
      path: llbotPath,
      hint: fs.existsSync(llbotPath) ? 'LLBot 可执行文件存在' : `需要把 LLBot 放到 ${llbotPath}`,
    };
  }
  const llbotCwd = payload.paths?.llbotCwd || payload.qq?.llbot_cwd;
  if (llbotCwd) {
    status.llbotCwd = {
      ok: fs.existsSync(llbotCwd),
      path: llbotCwd,
      hint: fs.existsSync(llbotCwd) ? 'LLBot 工作目录存在' : `请创建 ${llbotCwd}`,
    };
  }
  const dbPort = parseInt(payload.paths?.dbPort || payload.db?.port || '3001', 10);
  status.db = {
    ok: dbPort > 0 && dbPort < 65536,
    port: dbPort,
    hint: dbPort > 0 ? `DB-Server 将监听 ${dbPort}` : 'DB 端口无效',
  };
  const bridgeToken = payload.tokens?.bridgeAuthToken || payload.qq?.bridge_auth_token || '';
  status.bridge = {
    ok: !bridgeToken || bridgeToken.length >= 8,
    token: bridgeToken ? `${bridgeToken.length} chars` : '未设置',
    hint: bridgeToken ? 'Bridge Token 长度合法' : '未设置 Bridge Token（仅本机访问无需）',
  };
  return status;
}

export function summarizeChecks(status) {
  const lines = [];
  for (const [k, v] of Object.entries(status)) {
    lines.push(`${v.ok ? '√' : '×'} ${k.padEnd(10)} ${v.hint}`);
  }
  return lines;
}