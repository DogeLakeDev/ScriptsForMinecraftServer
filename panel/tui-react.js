/**
 * tui-react.js — 入口文件
 *
 * 拆分后:
 *   - theme.js          颜色常量
 *   - log-buffer.js     日志 buffer + 文件持久化
 *   - log-buffer-hooks.js  React 桥接 hook
 *   - mouse.js          SGR 鼠标滚轮
 *   - views/views.js    Dashboard / SvcView / CfgList / CfgEdit
 *   - app.js            App 根组件 + useInput
 *   - tui-react.js      mount() 入口 (本文件)
 *
 * require 时不产生副作用, 所有副作用在 mount() 中执行
 */

import { render } from 'ink';
import React from 'react';
const h = React.createElement;

import { services } from './services/manager.js';
import { pushLog, closeLogFile } from './log-buffer.js';
import { T } from './theme.js';
import { App } from './app.js';

let _mounted = false;

function bindServiceOutput() {
  for (const svc of Object.values(services)) {
    svc.events.on('output', (text, level) => {
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (t) pushLog(t, level || 'info', svc.name);
      }
    });
  }
}

async function mount({ onReady } = {}) {
  if (_mounted) throw new Error('tui-react already mounted');
  _mounted = true;

  bindServiceOutput();
  // Do not enable terminal mouse reporting: it intercepts native click-drag
  // selection in common terminals. Logs remain keyboard-scrollable and copyable.
  const cleanup = () => { closeLogFile(); };
  process.on('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });

  const instance = render(h(App));
  if (onReady) {
    Promise.resolve().then(async () => {
      const readyState = await onReady();
      instance.rerender(h(App, { initialSetupRequired: readyState?.setupRequired ?? null }));
    });
  }
  return instance.waitUntilExit();
}

export { mount, pushLog, T, services };
