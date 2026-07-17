/**
 * routes/modules.ts — 模块目录与启停
 */

interface Deps {
  loadModuleCatalog: () => unknown[];
  buildModuleList: () => Array<Record<string, unknown>>;
  resolveModuleByKey: (key: string) => { id: string; canDisable: boolean } | null;
  setModuleEnabled: (
    module: { id: string; canDisable: boolean },
    enabled: boolean
  ) => void;
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
}

function createModuleRoutes({
  loadModuleCatalog,
  buildModuleList,
  resolveModuleByKey,
  setModuleEnabled,
  body,
  json,
}: Deps) {
  return async function handleModuleRoute({
    path,
    method,
    params,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    void params; // unused
    if (path === "/api/sfmc/modules/catalog") {
      if (method === "GET") {
        json(res, { modules: loadModuleCatalog() });
      } else {
        json(res, { success: false, error: "not_found" }, 404);
      }
      return true;
    }
    if (path === "/api/sfmc/modules") {
      if (method === "GET") json(res, { modules: buildModuleList() });
      else json(res, { success: false, error: "not_found" }, 404);
      return true;
    }
    if (!path.startsWith("/api/sfmc/modules/")) return false;

    const rest = path.slice("/api/sfmc/modules/".length);
    const [rawKey, action] = rest.split("/");
    const module = resolveModuleByKey(decodeURIComponent(rawKey ?? ""));
    if (!module) {
      json(res, { success: false, error: "module_not_found" }, 404);
      return true;
    }

    const current = () => buildModuleList().find((entry) => entry.id === module.id);
    if (!action && method === "GET") {
      json(res, { module: current() ?? null });
    } else if (!action && (method === "PATCH" || method === "PUT")) {
      const { enabled } = await body(req);
      if (!enabled && !module.canDisable) {
        json(res, { success: false, error: "module_cannot_disable" }, 400);
        return true;
      }
      try {
        setModuleEnabled(module, !!enabled);
      } catch (error) {
        const e = error as { code?: string; unmet?: Array<{ id: string }> };
        if (e.code === "dependency_unmet") {
          json(res, { success: false, error: "dependency_unmet", unmet: e.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else if (action === "enable" && method === "POST") {
      try {
        setModuleEnabled(module, true);
      } catch (error) {
        const e = error as { code?: string; unmet?: Array<{ id: string }> };
        if (e.code === "dependency_unmet") {
          json(res, { success: false, error: "dependency_unmet", unmet: e.unmet }, 409);
          return true;
        }
        throw error;
      }
      json(res, { success: true, module: current() });
    } else if (action === "disable" && method === "POST") {
      if (!module.canDisable) {
        json(res, { success: false, error: "module_cannot_disable" }, 400);
        return true;
      }
      setModuleEnabled(module, false);
      json(res, { success: true, module: current() });
    } else {
      json(res, { success: false, error: "not_found" }, 404);
    }
    return true;
  };
}

export { createModuleRoutes };
