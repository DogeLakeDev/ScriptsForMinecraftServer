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
import { enableMouse, disableMouse } from './mouse.js';
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

function mount() {
  if (_mounted) throw new Error('tui-react already mounted');
  _mounted = true;

  bindServiceOutput();
  enableMouse();

  const cleanup = () => { disableMouse(); closeLogFile(); };
  process.on('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });

  return render(h(App)).waitUntilExit();
}

export { mount, pushLog, T, enableMouse, disableMouse, services };
