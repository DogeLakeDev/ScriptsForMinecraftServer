function createModuleRoutes({ loadModuleCatalog, buildModuleList, resolveModuleByKey, setModuleEnabled, setModuleInstalled, body, json }) {
  return async function handleModuleRoute({ path, method, req, res }) {
    if (path === '/api/sfmc/modules/catalog') {
      if (method === 'GET') json(res, { modules: loadModuleCatalog() });
      else json(res, { success: false, error: 'not_found' }, 404);
      return true;
    }

    if (path === '/api/sfmc/modules') {
      if (method === 'GET') json(res, { modules: buildModuleList() });
      else json(res, { success: false, error: 'not_found' }, 404);
      return true;
    }

    if (!path.startsWith('/api/sfmc/modules/')) return false;

    const rest = path.slice('/api/sfmc/modules/'.length);
    const [rawKey, action] = rest.split('/');
    const module = resolveModuleByKey(decodeURIComponent(rawKey || ''));
    if (!module) {
      json(res, { success: false, error: 'module_not_found' }, 404);
      return true;
    }

    const current = () => buildModuleList().find((entry) => entry.id === module.id);
    if (!action && method === 'GET') {
      json(res, { module: current() || null });
    } else if (!action && (method === 'PATCH' || method === 'PUT')) {
      const { enabled } = await body(req);
      if (!enabled && !module.canDisable) {
        json(res, { success: false, error: 'module_cannot_disable' }, 400);
        return true;
      }
      try {
        setModuleEnabled(module, !!enabled);
      } catch (error) {
        if (error.code === 'dependency_unmet') {
          json(res, { success: false, error: 'dependency_unmet', unmet: error.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else if (action === 'enable' && method === 'POST') {
      try {
        setModuleEnabled(module, true);
      } catch (error) {
        if (error.code === 'dependency_unmet') {
          json(res, { success: false, error: 'dependency_unmet', unmet: error.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else if (action === 'disable' && method === 'POST') {
      if (!module.canDisable) {
        json(res, { success: false, error: 'module_cannot_disable' }, 400);
        return true;
      }
      setModuleEnabled(module, false);
      json(res, { success: true, module: current() });
    } else if (action === 'install' && method === 'POST') {
      try {
        setModuleInstalled(module, true);
      } catch (error) {
        if (error.code === 'dependency_unmet') {
          json(res, { success: false, error: 'dependency_unmet', unmet: error.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else if (action === 'uninstall' && method === 'POST') {
      if (!module.canUninstall) {
        json(res, { success: false, error: 'module_cannot_uninstall' }, 400);
        return true;
      }
      try {
        setModuleInstalled(module, false);
      } catch (error) {
        if (error.code === 'dependency_required') {
          json(res, { success: false, error: 'dependency_required', requiredBy: error.requiredBy }, 409);
          return true;
        }
        if (error.code === 'dependency_unmet') {
          json(res, { success: false, error: 'dependency_unmet', unmet: error.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else {
      json(res, { success: false, error: 'not_found' }, 404);
    }
    return true;
  };
}

module.exports = { createModuleRoutes };
