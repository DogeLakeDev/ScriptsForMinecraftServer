import { useMemo, useState } from "react";
// @ts-expect-error virtual module injected by pluginModuleCatalog
import registry from "virtual-sfmc-module-registry";

declare global {
  interface ImportMeta {
    readonly env: {
      SSG_MD?: boolean;
      [key: string]: unknown;
    };
  }
}

type ModuleEntry = {
  id: string;
  repo?: string;
  tag?: string;
  description?: string;
};

type RegistryFile = {
  version?: number;
  source?: string;
  modules: ModuleEntry[];
};

const data = registry as RegistryFile;

export default function ModuleCatalog() {
  const [q, setQ] = useState("");
  const modules = useMemo(() => {
    const list = data.modules ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (m) =>
        m.id.toLowerCase().includes(needle) ||
        (m.description ?? "").toLowerCase().includes(needle)
    );
  }, [q]);

  if (import.meta.env.SSG_MD) {
    const lines = (data.modules ?? [])
      .map((m) => `- \`${m.id}\`${m.tag ? ` (${m.tag})` : ""}`)
      .join("\n");
    return <>{`\n\n### Module registry\n\n${lines}\n`}</>;
  }

  return (
    <div className="sfmc-module-catalog">
      <p>
        来源：{data.source ?? "registry"}
        {data.modules?.length != null ? ` · ${data.modules.length} 个模块` : ""}
      </p>
      <input
        type="search"
        placeholder="按 id 筛选…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="筛选模块"
      />
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>tag</th>
            <th>安装</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.id}>
              <td>
                <code>{m.id}</code>
              </td>
              <td>{m.tag ?? "—"}</td>
              <td>
                <code>{`sfmc> mod install ${m.id}`}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
