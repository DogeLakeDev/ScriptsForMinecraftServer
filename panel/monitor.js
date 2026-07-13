import React, { useState, useEffect } from 'react';
import os from 'node:os';
import http from 'node:http';
import { exec } from 'node:child_process';
import pidusage from 'pidusage';
import { services } from './services/manager.js';
import { getDbBaseUrl } from './api/client.js';


let _state = {
  systemMem: { total: 0, free: 0, used: 0, percent: 0 },
  systemCpu: 0,
  svc: {
    panel: { mem: null, cpu: 0 },
    bds: { mem: null, cpu: 0 },
    db: { mem: null, cpu: 0 },
    qq: { mem: null, cpu: 0 },
    llbot: { mem: null, cpu: 0 },
  },
  tps: 0,
  entities: {},
  players: [],
  totalChunks: 0,
  summaryAt: 0,
  tick: 0,
};
let _listeners = [];

function clone(s) {
  return {
    ...s,
    systemMem: { ...s.systemMem },
    svc: Object.fromEntries(Object.entries(s.svc).map(([k, v]) => [k, { ...v }])),
    entities: { ...s.entities },
    players: s.players.map(p => ({ ...p })),
    summaryAt: s.summaryAt,
  };
}

function notify() {
  const snapshot = clone(_state);
  for (const fn of _listeners) fn(snapshot);
}

export function getState() {
  return clone(_state);
}

let _tick = 0;

function poll() {
  _state.tick = _tick++;
  collectSystem();
  collectSystemCPU();
  collectProcs();
  fetchMonitorSummary();
  notify();
}

let _pollTimer = null;

function startPolling() {
  if (_pollTimer) return;
  poll(); // 立即采一次
  _pollTimer = setInterval(poll, 3000);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

// ── 系统内存 ──

function collectSystem() {
  const total = os.totalmem();
  const free = os.freemem();
  _state.systemMem = {
    total,
    free,
    used: total - free,
    percent: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
  };
}

// ── 系统 CPU（差分法）──

let _prevSysCPU = null;

function collectSystemCPU() {
  const cpus = os.cpus();
  let idle = 0, tick = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    tick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  if (_prevSysCPU) {
    const dIdle = idle - _prevSysCPU.idle;
    const dTick = tick - _prevSysCPU.tick;
    if (dTick > 0) _state.systemCpu = Math.round((1 - dIdle / dTick) * 100);
  }
  _prevSysCPU = { idle, tick };
}

// ── 进程 CPU + 内存（pidusage）──

let _prevPanelCPU = null;
let _prevPanelTime = 0;

function collectProcs() {
  // 面板自身：process.cpuUsage() 差分
  const curPU = process.cpuUsage();
  const curTime = Date.now();
  let panelCPU = 0;
  if (_prevPanelCPU && _prevPanelTime > 0) {
    const dUser = curPU.user - _prevPanelCPU.user;
    const dSys = curPU.system - _prevPanelCPU.system;
    const dWall = curTime - _prevPanelTime;
    panelCPU = dWall > 0 ? Math.min(100, Math.round((dUser + dSys) / (dWall * 10) * 100) / 100) : 0;
  }
  _prevPanelCPU = curPU;
  _prevPanelTime = curTime;
  _state.svc.panel = {
    mem: Math.round(process.memoryUsage().rss / 1048576),
    cpu: panelCPU,
  };

  // 外部进程
  const jobs = [];
  for (const key of ['bds', 'db', 'qq', 'llbot']) {
    const svc = services[key];
    if (svc?.pid) jobs.push({ key, pid: svc.pid });
  }
  const active = new Set(jobs.map((job) => job.key));
  for (const key of ['bds', 'db', 'qq', 'llbot']) {
    if (!active.has(key)) _state.svc[key] = { mem: null, cpu: 0 };
  }
  if (jobs.length === 0) return;

  const pids = jobs.map(j => j.pid);
  pidusage(pids)
    .then(results => {
      for (const { key, pid } of jobs) {
        const info = results[pid];
        _state.svc[key] = {
          mem: info ? Math.round(info.memory / 1048576) : null,
          cpu: info ? Math.min(100, Math.round(info.cpu * 100) / 100) : 0,
        };
      }
      notify();
    })
    .catch(() => {
      for (const { key, pid } of jobs) _queryTasklistMem(pid, key);
    });
}

function _queryTasklistMem(pid, key) {
  exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { timeout: 2000 }, (err, stdout) => {
    if (err) return;
    const line = stdout.trim();
    if (!line) return;
    const parts = line.match(/"([^"]*)"/g);
    if (parts && parts.length >= 5) {
      const kb = parseInt(parts[4].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(kb)) {
        _state.svc[key] = { mem: Math.round(kb / 1024), cpu: 0 };
        notify();
      }
    }
  });
}

// ── db-server 监控摘要 ──

function fetchMonitorSummary() {
  http.get(
    `${getDbBaseUrl()}/api/sfmc/monitor/summary`,
    { timeout: 2000 },
    (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          _state.tps = d.tps || 0;
          _state.entities = d.entities || {};
          _state.players = d.players || [];
          _state.totalChunks = d.totalChunks || 0;
          _state.summaryAt = Date.now();
          notify();
        } catch (e) { /* endpoint not available yet */ }
      });
    },
  ).on('error', () => { /* db-server not running */ });
}

// ── React hook ──

export function useMonitor() {
  const [data, setData] = useState(null);
  useEffect(() => {
    _listeners.push(setData);
    if (_listeners.length === 1) startPolling();
    setData(clone(_state));
    return () => {
      _listeners = _listeners.filter(fn => fn !== setData);
      if (_listeners.length === 0) stopPolling();
    };
  }, []);
  return data;
}
