const fs = require('node:fs');
const path = require('node:path');

function loadModuleLock(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { version: 1, modules: data && data.modules && typeof data.modules === 'object' ? data.modules : {} };
  } catch {
    return { version: 1, modules: {} };
  }
}

function saveModuleLock(filePath, lock) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({ version: 1, modules: lock.modules || {} }, null, 2) + '\n');
  fs.renameSync(tempPath, filePath);
}

function getModuleState(lock, id, defaults = {}) {
  const state = lock.modules[id];
  return state && typeof state === 'object' ? state : defaults;
}

function isEnabled(lock, id, defaultEnabled = false) {
  return getModuleState(lock, id).enabled ?? defaultEnabled;
}

function updateModuleState(lock, id, patch) {
  const now = Date.now();
  const previous = getModuleState(lock, id);
  lock.modules[id] = {
    ...previous,
    ...patch,
    updatedAt: now,
  };
  return lock.modules[id];
}

module.exports = { loadModuleLock, saveModuleLock, getModuleState, isEnabled, updateModuleState };
