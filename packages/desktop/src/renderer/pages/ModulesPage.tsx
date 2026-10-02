/**
 * ModulesPage.tsx — 模块管理
 *
 * 使用场景："已安装"列出本地模块并切换启用/卸载；"发现"浏览官方模块索引并安装。
 * 所有写操作沿用原实现的方法与参数（modules.toggle / modules.uninstall / modules.install），
 * 在后台维护任务中停服、备份并重建行为包。
 */
import type { ModuleRow } from "@sfmc-bds/management";
import { useEffect, useMemo, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, IconButton, SearchInput, Segmented, Switch } from "../components/controls.js";
import { Menu } from "../components/overlays.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, Callout, EmptyState, IconTile, PageHeader, Surface } from "../components/ui.js";
import { errorText } from "../lib/format.js";

/** 模块索引条目（modules.search 返回的结构：id + 索引元数据） */
interface RegistryModule {
  id: string;
  npm?: string;
  version?: string;
  sdk?: string;
  repo?: string;
  tag?: string;
}

/** 已安装模块列表 */
function InstalledModules() {
  const { model, editable, submit } = useDesktop();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "enabled" | "disabled">("all");
  const enabledCount = model.modules.filter((row) => row.enabled).length;
  const rows = model.modules.filter(
    (row) =>
      (status === "all" || (status === "enabled" ? row.enabled : !row.enabled)) &&
      `${row.id} ${row.folder}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <Surface flush>
      <div className="list-toolbar">
        <SearchInput size="sm" placeholder="筛选模块" aria-label="筛选模块" value={query} onChange={setQuery} className="toolbar-search" />
        <Segmented
          size="sm"
          label="启用状态"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "全部", count: model.modules.length },
            { value: "enabled", label: "已启用", count: enabledCount },
            { value: "disabled", label: "已停用", count: model.modules.length - enabledCount },
          ]}
        />
      </div>
      {rows.length ? (
        <ul className="row-list">
          {rows.map((row: ModuleRow) => (
            <li key={row.folder} className={`row-item${row.enabled ? "" : " muted-row"}`}>
              <IconTile icon="modules" tone={row.enabled ? "pastel-2" : "neutral"} size={32} />
              <div className="row-main">
                <div className="row-title">
                  <b title={row.id}>{row.id}</b>
                  {row.linked && <Badge tone="info" icon="link">本地链接</Badge>}
                </div>
                <div className="row-sub mono">{row.folder}</div>
              </div>
              <span className="row-version mono">{row.version}</span>
              <Tooltip content={editable ? (row.enabled ? "停用模块" : "启用模块") : "完成接入后可修改"} wrap>
                <Switch size="sm" label={`${row.enabled ? "停用" : "启用"}模块 ${row.id}`} disabled={!editable} checked={row.enabled} onChange={(enabled) => void submit("modules.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"}模块 ${row.id}`, { description: "将停服、备份并重建行为包后恢复运行。" })} />
              </Tooltip>
              <Menu
                trigger={<IconButton icon="more" label="更多" size="sm" />}
                items={[{ key: "uninstall", danger: true, disabled: !editable || row.linked, icon: "trash", label: row.linked ? "本地链接模块不可卸载" : "卸载模块", onSelect: () => void submit("modules.uninstall", { id: row.folder }, `卸载 ${row.id}`, { danger: true, okText: "卸载", description: "将移除模块文件并重建行为包；模块写入的数据保留在数据库中。" }) }]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="modules" title={model.modules.length ? "没有匹配的模块" : "尚未安装模块"} action={model.modules.length ? <Button size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>清除筛选</Button> : undefined} />
      )}
    </Surface>
  );
}

/** 模块索引浏览与安装 */
function DiscoverModules() {
  const { model, editable, submit, request } = useDesktop();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryModule[]>();
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = (text: string) => {
    setLoading(true);
    setError("");
    request("modules.search", { query: text })
      .then((result) => {
        setResults(result.modules as RegistryModule[]);
        setStale(Boolean((result as { stale?: boolean }).stale));
      })
      .catch((reason) => setError(errorText(reason)))
      .finally(() => setLoading(false));
  };
  useEffect(() => search(""), [request]);
  const installed = useMemo(() => new Map(model.modules.flatMap((row) => [[row.id, row], [row.folder, row]] as const)), [model.modules]);
  return (
    <Surface flush>
      <div className="list-toolbar">
        <SearchInput
          size="sm"
          placeholder="搜索模块"
          aria-label="搜索官方模块索引"
          value={query}
          onChange={(value) => {
            setQuery(value);
            if (!value) search("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); search(query); }
          }}
          className="toolbar-search wide"
        />
        <Button size="sm" loading={loading} onClick={() => search(query)}>搜索</Button>
        {stale && <Badge tone="warning" icon="warning">离线缓存</Badge>}
      </div>
      {error && <div className="surface-pad"><Callout tone="danger" title="无法读取模块索引">{error}</Callout></div>}
      {results && results.length > 0 && (
        <div className="registry-grid">
          {results.map((row) => {
            const local = installed.get(row.id) ?? installed.get(`sfmc-module-${row.id}`);
            const differentVersion = local && row.version && local.version !== row.version;
            return (
              <div key={row.id} className="registry-card">
                <div className="registry-head">
                  <IconTile icon="modules" tone="pastel-1" size={32} />
                  <div className="registry-title">
                    <b className="truncate" title={row.id}>{row.id}</b>
                    <span className="mono truncate" title={row.npm ?? row.repo}>{row.npm ?? (row.repo ? `${row.repo}@${row.tag}` : "—")}</span>
                  </div>
                </div>
                <div className="registry-meta">
                  {row.version && <Badge className="mono">v{row.version}</Badge>}
                  {row.sdk && <Badge className="mono" title="兼容的 SDK 版本范围">SDK {row.sdk}</Badge>}
                  {row.repo && <Badge icon="external">GitHub</Badge>}
                </div>
                <div className="registry-foot">
                  {local ? (
                    <span className="registry-installed"><span className="mono">本地 {local.version}</span>{differentVersion && <span className="tone-text-info"> 版本不同</span>}</span>
                  ) : <span />}
                  <Button size="sm" variant={local ? "secondary" : "primary"} disabled={!editable || Boolean(local)} onClick={() => void submit("modules.install", { id: row.id }, `安装模块 ${row.id}`, { description: "将下载模块、停服备份并重建行为包后恢复运行。" })} icon={local ? "check" : "download"}>
                    {local ? "已安装" : "安装"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {results && !results.length && !error && <EmptyState icon="search" title="没有找到模块" action={query && <Button size="sm" onClick={() => { setQuery(""); search(""); }}>清除搜索</Button>} />}
      {!results && !error && <div className="registry-grid">{Array.from({ length: 6 }, (_, index) => <div key={index} className="registry-card skeleton" />)}</div>}
    </Surface>
  );
}

export function ModulesPage() {
  const { model } = useDesktop();
  const [tab, setTab] = useState<"installed" | "discover">("installed");
  return (
    <div className="page">
      <PageHeader
        title="模块管理"
        
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            label="视图"
            options={[
              { value: "installed", label: "已安装", icon: "list", count: model.modules.length },
              { value: "discover", label: "可安装", icon: "search" },
            ]}
          />
        }
      />
      {tab === "installed" ? <InstalledModules /> : <DiscoverModules />}
    </div>
  );
}
