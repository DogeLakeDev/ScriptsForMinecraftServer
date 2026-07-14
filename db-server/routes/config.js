function createConfigRoutes({
  query,
  quoteIdentifier,
  body,
  json,
  path,
  loadPanelState,
  applyInitPayload,
  applyInitReset,
  runSetupChecks,
  projectRoot,
  fs,
  loadModuleCatalog,
  loadModuleLock,
  saveModuleLock,
  updateModuleState,
}) {
  return async function handleConfigRoute({ path: requestPath, method, req, res }) {
    if (requestPath === '/api/sfmc/configs/import') {
      if (method !== 'POST') {
        json(res, { success: false, error: 'not_found' }, 404);
        return true;
      }
      const { table, rows } = await body(req);
      if (!table || !Array.isArray(rows) || rows.length === 0) {
        json(res, { success: false, error: 'invalid' }, 400);
        return true;
      }
      const now = Date.now();
      for (const row of rows) row.updated_at = now;
      if (table === 'modules') {
        const lock = loadModuleLock();
        const catalog = loadModuleCatalog();
        for (const row of rows) {
          const module = catalog.find((entry) => entry.id === row.id || entry.configKey === row.name);
          if (module) updateModuleState(lock, module.id, { enabled: !!row.enabled });
        }
        saveModuleLock(lock);
      } else if (table === 'settings') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', [row.key, String(row.value), now]);
      } else if (table === 'areas') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [row.module, row.name || '', row.dimension, row.start_x, row.start_z, row.end_x, row.end_z, now]);
      } else if (table === 'peace_filters') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?, ?, ?)', [row.family, row.exclude_family || '', now]);
      } else if (table === 'grids') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [row.name, row.start_x, row.start_y, row.start_z, row.size_h, row.size_v, row.direction, row.face, now]);
      } else if (table === 'banned_items') {
        for (const row of rows) query('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?, ?)', [row.item_id, now]);
      } else if (table === 'clean') {
        query('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1, ?, ?, ?)', [rows[0].item_max ?? 192, rows[0].poll_interval ?? 60, now]);
      } else if (table === 'permissions') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?, ?, ?)', [row.player_name, row.level, now]);
      } else if (table === 'qa_questions') {
        for (const row of rows) {
          const result = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', [row.weight ?? 1, row.question, JSON.stringify(row.answers || []), row.msg_right || '', row.msg_wrong || '', row.explanation || '', row.min_rank ?? null, row.max_rank ?? null, now]);
          const questionId = result[0]?.id;
          if (questionId && row.rewards) {
            for (const reward of row.rewards) query('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [questionId, reward.min_rank ?? null, reward.max_rank ?? null, reward.type, reward.amount ?? 0, reward.item_type || '', reward.item_aux ?? 0, reward.cmd || '', now]);
          }
          if (questionId && row.punishments) {
            for (const punishment of row.punishments) query('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?, ?, ?, ?)', [questionId, punishment.type || 'cmd', punishment.cmd, now]);
          }
        }
      } else if (table === 'coop_shop_groups') {
        for (const row of rows) query('INSERT OR REPLACE INTO sfmc_coop_shop_groups (groupid, displayname, displaydescribe, icon, type_function, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [row.groupid, row.displayname, row.displaydescribe || '', row.icon || '', row.type_function || '', now]);
      } else {
        json(res, { success: false, error: 'unknown_table' }, 400);
        return true;
      }
      json(res, { success: true, count: rows.length });
      return true;
    }

    if (requestPath.startsWith('/api/sfmc/configs/updated-since/')) {
      if (method !== 'GET') {
        json(res, { success: false, error: 'not_found' }, 404);
        return true;
      }
      const ts = parseInt(requestPath.slice('/api/sfmc/configs/updated-since/'.length), 10);
      if (Number.isNaN(ts)) {
        json(res, { success: false, error: 'invalid_ts' }, 400);
        return true;
      }
      const updated = {};
      const tables = ['sfmc_config_settings', 'sfmc_config_areas', 'sfmc_config_permissions', 'sfmc_config_qa_questions', 'sfmc_config_clean', 'sfmc_config_banned_items', 'sfmc_config_grids', 'sfmc_config_peace_filters'];
      for (const table of tables) {
        const rows = query(`SELECT * FROM ${quoteIdentifier(table, 'table')} WHERE updated_at > ?`, [ts]);
        if (rows.length > 0) updated[table.replace('sfmc_config_', '')] = rows;
      }
      json(res, { updated, timestamp: Date.now() });
      return true;
    }

    if (requestPath === '/api/sfmc/settings') {
      if (method === 'GET') json(res, { settings: query('SELECT * FROM sfmc_config_settings') });
      else json(res, { success: false, error: 'not_found' }, 404);
      return true;
    }
    if (requestPath.startsWith('/api/sfmc/settings/')) {
      const key = requestPath.slice('/api/sfmc/settings/'.length);
      if (method === 'GET') {
        const rows = query('SELECT value FROM sfmc_config_settings WHERE key = ?', [key]);
        json(res, { value: rows.length > 0 ? rows[0].value : null });
      } else if (method === 'PATCH' || method === 'PUT') {
        const { value } = await body(req);
        query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(value ?? ''), Date.now()]);
        try {
          const settingsPath = path.join(projectRoot, 'configs', 'settings.json');
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          settings[key] = value;
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
        } catch (error) {
          console.warn(`[ConfigSync] settings.json 同步失败: ${error.message}`);
        }
        json(res, { success: true });
      } else json(res, { success: false, error: 'not_found' }, 404);
      return true;
    }

    if (requestPath === '/api/sfmc/setup/state' && method === 'GET') {
      const state = loadPanelState();
      json(res, { state, initialized: !!state._initialized });
      return true;
    }
    if (requestPath === '/api/sfmc/setup/init' && method === 'POST') {
      const result = applyInitPayload((await body(req)) || {});
      json(res, { success: true, state: result.state, written: result.written });
      return true;
    }
    if (requestPath === '/api/sfmc/setup/reset' && method === 'POST') {
      const result = applyInitReset((await body(req)) || {});
      json(res, { success: true, state: result.state, restored: result.restored });
      return true;
    }
    if (requestPath === '/api/sfmc/setup/check' && method === 'POST') {
      const checks = runSetupChecks((await body(req)) || {});
      json(res, { checks });
      return true;
    }
    return false;
  };
}

module.exports = { createConfigRoutes };
