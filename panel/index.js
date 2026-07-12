#!/usr/bin/env node

/**
 * BDS Panel — 统一管理界面（Ink/React 版）
 *
 * 用法:
 *   node panel/index.js
 *
 * process.env.NODE_ENV 必须在加载 React/Ink 之前设置，
 * 因此使用动态 import() 而非静态 import。
 */

process.env.NODE_ENV = 'production';

const { pushLog, mount } = await import('./tui-react.js');
const { services } = await import('./services/manager.js');

async function boot() {
  console.clear();
  pushLog('BDS Panel 已启动');
  pushLog('正在启动 db-server 和 qq-bridge...');

  const results = await Promise.allSettled([
    services.db.start(),
    services.qq.start(),
  ]);
  results.forEach((r, i) => {
    const name = i === 0 ? 'db-server' : 'qq-bridge';
    if (r.status === 'fulfilled') pushLog(`${name} 已就绪`);
    else pushLog(`${name} 启动失败: ${r.reason?.message || r.reason}`, 'error');
  });
}

boot().catch((e) => pushLog(`启动异常: ${e.message}`, 'error'));

mount().then(() => {
  process.exit(0);
});
