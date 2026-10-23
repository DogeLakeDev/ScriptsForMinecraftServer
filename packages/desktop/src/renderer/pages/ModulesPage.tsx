/**
 * ModulesPage.tsx — 模块管理
 *
 * 使用场景："已安装"列出本地模块并切换启用/卸载；"可安装"浏览官方模块索引。
 * 点击模块卡片打开详情。安装前先核对 requires：未安装或未启用都不开始下载，并在详情里说明下一步。
 * 安装、启用、停用和卸载不停止或重启服务，由独立按钮手动重启 BDS。
 * 卸载按钮直接放在行内；本地链接的开发模块仍不可卸载。
 */
import type { ModuleRow } from "@sfmc-bds/management";
import { assessModuleRequires } from "../lib/module-dependencies.js";
import { useEffect, useMemo, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, IconButton, SearchInput, Segmented, Switch } from "../components/controls.js";
import { ManualRestartNotice, RestartServicesButton, useManualRestartSupport } from "../components/RestartServicesButton.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, Callout, EmptyState, IconTile, PageHeader, Surface } from "../components/ui.js";
import { errorText } from "../lib/format.js";
import { ModuleDetailSheet, moduleTitle, type RegistryModule } from "./ModuleDetailSheet.js";

/** 已安装模块列表 */
function InstalledModules() {
  const { model, editable: connectedEditable, submit } = useDesktop();
  const supportsManualRestart = useManualRestartSupport();
  const editable = connectedEditable && supportsManualRestart;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "enabled" | "disabled">("all");
  const enabledCount = model.modules.filter((row) => row.enabled).length;
  const rows = model.modules.filter(
    (row) =>
      (status === "all" || (status === "enabled" ? row.enabled : !row.enabled)) &&
      `${row.id} ${row.folder} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())
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
          {rows.map((row: ModuleRow) => {
            const title = row.name && row.name !== row.id ? row.name : row.id;
            return (
            <li key={row.folder} className={`row-item${row.enabled ? "" : " muted-row"}`}>
              <IconTile icon="modules" tone={row.enabled ? "pastel-2" : "neutral"} size={32} />
              <div className="row-main">
                <div className="row-title">
                  <b title={row.id}>{title}</b>
                  {row.linked && <Badge tone="info" icon="link">本地链接</Badge>}
                </div>
                <div className="row-sub mono">{title === row.id ? row.folder : row.id}</div>
              </div>
              <span className="row-version mono">{row.version}</span>
              <div className="row-actions">
                <Tooltip content={editable ? (row.enabled ? "停用模块" : "启用模块") : "当前为只读"} wrap>
                  <Switch size="sm" label={`${row.enabled ? "停用" : "启用"}模块 ${row.id}`} disabled={!editable} checked={row.enabled} onChange={(enabled) => void submit("modules.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"}模块 ${row.id}`, { description: "将更新模块状态并重建行为包，可在操作完成后手动重启 BDS。" })} />
                </Tooltip>
                <Tooltip content={!editable ? "当前为只读" : row.linked ? "本地链接模块不可卸载" : "卸载模块"} wrap>
                  <IconButton
                    icon="trash"
                    label={`卸载模块 ${row.id}`}
                    size="sm"
                    danger
                    tooltip={false}
                    disabled={!editable || row.linked}
                    onClick={() => void submit("modules.uninstall", { id: row.folder }, `卸载 ${row.id}`, { danger: true, okText: "卸载", description: "将移除模块文件并重建行为包；模块写入的数据保留在数据库中。操作完成后可手动重启 BDS。" })}
                  />
                </Tooltip>
              </div>
            </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="modules" title={model.modules.length ? "没有匹配的模块" : "尚未安装模块"} action={model.modules.length ? <Button size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>清除筛选</Button> : undefined} />
      )}
    </Surface>
  );
}

/** 模块索引浏览、详情与安装。依赖不通过时只打开详情，不提交安装任务。 */
function DiscoverModules({ onShowInstalled }: { onShowInstalled: () => void }) {
  const { model, editable: connectedEditable, submit, request } = useDesktop();
  const supportsManualRestart = useManualRestartSupport();
  const editable = connectedEditable && supportsManualRestart;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryModule[]>();
  /** 最近一次不带关键字的索引，供依赖跳转时查找被筛选掉的模块。 */
  const [catalog, setCatalog] = useState<RegistryModule[]>([]);
  /** 详情抽屉的打开栈。点依赖的「查看」会叠上一个模块，返回时回到上一层。 */
  const [stack, setStack] = useState<string[]>([]);
  /** 关闭动画期间继续展示刚才的模块，避免抽屉先变成空白。 */
  const [rememberedId, setRememberedId] = useState<string>();
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = (text: string) => {
    setLoading(true);
    setError("");
    request("modules.search", { query: text })
      .then((result) => {
        const modules = result.modules as RegistryModule[];
        setResults(modules);
        if (!text.trim()) setCatalog(modules);
        setStale(Boolean((result as { stale?: boolean }).stale));
      })
      .catch((reason) => setError(errorText(reason)))
      .finally(() => setLoading(false));
  };
  useEffect(() => search(""), [request]);
  const installed = useMemo(() => new Map(model.modules.flatMap((row) => [[row.id, row], [row.folder, row]] as const)), [model.modules]);
  const selectedId = stack.at(-1) ?? rememberedId;
  if (stack.at(-1) && stack.at(-1) !== rememberedId) setRememberedId(stack.at(-1));
  const selected = selectedId ? catalog.find((row) => row.id === selectedId) ?? results?.find((row) => row.id === selectedId) : undefined;
  const installModule = (row: RegistryModule) => {
    // 已发布的 0.2.20 不会返回 requires。没有这个字段时保持原来的安装，不把全部模块都拦住。
    const requires = row.requires;
    if (Array.isArray(requires)) {
      const check = assessModuleRequires(requires, model.modules);
      if (!check.ok) {
        setStack([row.id]);
        return;
      }
    }
    const title = moduleTitle(row);
    void submit("modules.install", { id: row.id }, `安装模块 ${title}`, {
      description: Array.isArray(requires) && requires.length
        ? "依赖都已安装并启用。将下载模块并重建行为包，可在安装完成后手动重启 BDS。"
        : Array.isArray(requires)
          ? "这个模块没有额外依赖。将下载模块并重建行为包，可在安装完成后手动重启 BDS。"
          : "将下载模块并重建行为包，可在安装完成后手动重启 BDS。",
    });
  };
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
            const check = assessModuleRequires(row.requires, model.modules);
            const title = moduleTitle(row);
            return (
              <div
                key={row.id}
                className="registry-card"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  setStack([row.id]);
                }}
              >
                <div className="registry-head">
                  <IconTile icon="modules" tone="pastel-1" size={32} />
                  <div className="registry-title">
                    <button type="button" className="registry-open truncate" title={row.id} onClick={() => setStack([row.id])}>{title}</button>
                    <span className="mono truncate" title={row.npm ?? row.repo}>{row.npm ?? (row.repo ? `${row.repo}@${row.tag ?? ""}` : "—")}</span>
                  </div>
                </div>
                {row.description && <p className="registry-desc">{row.description}</p>}
                <div className="registry-meta">
                  {row.version && <Badge className="mono">v{row.version}</Badge>}
                  {row.sdk && <Badge className="mono" title="兼容的 SDK 版本范围">SDK {row.sdk}</Badge>}
                  {row.repo && <Badge icon="external">GitHub</Badge>}
                  {!local && check.declared && check.items.length > 0 && (
                    <Badge tone={check.ok ? "success" : "warning"}>{check.ok ? "依赖已满足" : "依赖未满足"}</Badge>
                  )}
                </div>
                <div className="registry-foot">
                  {local ? (
                    <span className="registry-installed"><span className="mono">本地 {local.version}</span>{differentVersion && <span className="tone-text-info"> 版本不同</span>}</span>
                  ) : <span />}
                  <Button
                    size="sm"
                    variant={local ? "secondary" : "primary"}
                    disabled={!editable || Boolean(local)}
                    icon={local ? "check" : "download"}
                    onClick={() => installModule(row)}
                  >
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
      <ModuleDetailSheet
        open={stack.length > 0}
        moduleId={selectedId}
        module={selected}
        catalog={catalog.length ? catalog : results ?? []}
        installed={model.modules}
        editable={editable}
        canBack={stack.length > 1}
        onBack={() => setStack((current) => current.slice(0, -1))}
        onClose={() => setStack([])}
        onOpenModule={(id) => setStack((current) => current.at(-1) === id ? current : [...current, id])}
        onShowInstalled={() => {
          setStack([]);
          onShowInstalled();
        }}
        onInstall={installModule}
      />
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
          <>
            <RestartServicesButton />
            <Segmented
              value={tab}
              onChange={setTab}
              label="视图"
              options={[
                { value: "installed", label: "已安装", icon: "list", count: model.modules.length },
                { value: "discover", label: "可安装", icon: "search" },
              ]}
            />
          </>
        }
      />
      <ManualRestartNotice />
      {tab === "installed" ? <InstalledModules /> : <DiscoverModules onShowInstalled={() => setTab("installed")} />}
    </div>
  );
}
