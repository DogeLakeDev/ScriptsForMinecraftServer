/**
 * ModuleDetailSheet.tsx — 可安装模块的详情抽屉
 *
 * 使用场景：模块管理「可安装」里点击卡片后，展示索引里的名称、说明和依赖。
 * 依赖未安装或未启用时，安装按钮不会提交任务，并给出下一步。
 */
import type { ModuleRow } from "@sfmc-bds/management";
import { assessModuleRequires, moduleIdentity } from "../lib/module-dependencies.js";
import { Button } from "../components/controls.js";
import { Sheet } from "../components/overlays.js";
import { Badge, Callout } from "../components/ui.js";

/** 模块索引条目。requires 缺失表示这份结果没有声明依赖，安装会被拒绝。 */
export interface RegistryModule {
  id: string;
  npm?: string;
  version?: string;
  sdk?: string;
  repo?: string;
  tag?: string;
  name?: string;
  description?: string;
  category?: string;
  license?: string;
  official?: boolean;
  requires?: string[];
}

/** 索引分类的展示名。没见过的分类直接显示原文。 */
const CATEGORY_LABELS: Record<string, string> = {
  system: "系统",
  utility: "工具",
  social: "社交",
  economy: "经济",
  gameplay: "玩法",
};

/** 卡片和抽屉共用的展示名。没有单独名称时用模块 id。 */
export function moduleTitle(row: { id: string; name?: string }): string {
  return row.name && row.name !== row.id ? row.name : row.id;
}

/** 在已加载的索引里按逻辑 id 找条目，供依赖行显示中文名。 */
function findCatalogModule(catalog: RegistryModule[], id: string): RegistryModule | undefined {
  const key = moduleIdentity(id);
  return catalog.find((row) => moduleIdentity(row.id) === key);
}

/** 本机是否已经有这个模块。目录名和逻辑 id 都算。 */
function findInstalled(installed: ModuleRow[], id: string): ModuleRow | undefined {
  const key = moduleIdentity(id);
  return installed.find((row) => moduleIdentity(row.id) === key || moduleIdentity(row.folder) === key);
}

export function ModuleDetailSheet({
  open,
  moduleId,
  module,
  catalog,
  installed,
  editable,
  canBack,
  onBack,
  onClose,
  onOpenModule,
  onShowInstalled,
  onInstall,
}: {
  open: boolean;
  /** 当前要看的模块 id。关闭动画期间仍保留上一次的 id，避免抽屉内容先被清空。 */
  moduleId?: string;
  module?: RegistryModule;
  catalog: RegistryModule[];
  installed: ModuleRow[];
  editable: boolean;
  canBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onOpenModule: (id: string) => void;
  onShowInstalled: () => void;
  onInstall: (row: RegistryModule) => void;
}) {
  const row = module ?? (moduleId ? { id: moduleId } : undefined);
  const check = row ? assessModuleRequires(row.requires, installed) : undefined;
  const local = row ? findInstalled(installed, row.id) : undefined;
  const title = row ? moduleTitle(row) : "模块详情";
  /** 只有索引真正给出了依赖数组、并且没通过时才禁止安装。 */
  const listed = Array.isArray(module?.requires);
  const blocked = listed && !check?.ok;
  const installLabel = local ? "已安装" : blocked ? "依赖未满足" : "安装";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={640}
      title={title}
      description={row && title !== row.id ? row.id : "模块详细信息"}
      actions={
        <>
          {canBack && <Button size="sm" icon="arrowLeft" onClick={onBack}>返回</Button>}
          <Button
            size="sm"
            variant="primary"
            icon={local ? "check" : "download"}
            disabled={!editable || !module || Boolean(local) || blocked}
            onClick={() => module && onInstall(module)}
          >
            {installLabel}
          </Button>
        </>
      }
    >
      {row && check && (
        <div className="sheet-stack">
          {!module && <Callout tone="warning" title="索引里没有这个模块">当前结果里找不到 {row.id}，无法从这里安装。先安装它，再回到依赖它的模块。</Callout>}
          {module && !listed && (
            <Callout tone="info" title="当前平台没有依赖名单">
              已发布的平台索引还不附带每个模块的依赖。安装仍按原来的方式进行；平台更新并带上依赖声明后，未满足的依赖才会阻止安装。
            </Callout>
          )}
          {module && listed && !check?.declared && (
            <Callout tone="danger" title="依赖名单无法使用">这份索引里的依赖名单格式不对，已停止安装。</Callout>
          )}
          {module && check.declared && !check.ok && (
            <Callout tone="warning" title="先处理依赖再安装">
              下面列出的模块要先安装并启用。尚未安装的可以打开它的详情继续；已停用的要到「已安装」里打开开关。依赖没通过时不会开始下载。
            </Callout>
          )}
          {module && check.declared && check.ok && check.items.length > 0 && (
            <Callout tone="success" title="依赖已满足">下面这些模块都已安装并启用，可以继续安装。</Callout>
          )}
          {module && check.declared && check.ok && check.items.length === 0 && (
            <Callout tone="info" title="没有额外依赖">索引声明这个模块不依赖其他模块，可以直接安装。</Callout>
          )}
          <p className="module-detail-desc">{module?.description || "索引没有填写说明。"}</p>
          <dl className="module-fact">
            {local && <><dt>本机</dt><dd>{local.enabled ? "已安装并启用" : "已安装，当前停用"} · {local.version}</dd></>}
            {module?.version && <><dt>版本</dt><dd className="mono">{module.version}</dd></>}
            {module?.sdk && <><dt>SDK</dt><dd className="mono">{module.sdk}</dd></>}
            {module?.category && <><dt>分类</dt><dd>{CATEGORY_LABELS[module.category] ?? module.category}</dd></>}
            {module?.license && <><dt>许可</dt><dd>{module.license}</dd></>}
            {module?.official !== undefined && <><dt>来源</dt><dd>{module.official ? "官方模块" : "社区模块"}</dd></>}
            {module?.npm && <><dt>npm</dt><dd className="mono">{module.npm}</dd></>}
            {module?.repo && (
              <>
                <dt>仓库</dt>
                <dd>
                  {/^https?:\/\//.test(module.repo) ? (
                    <a className="module-repo" href={module.repo} target="_blank" rel="noreferrer">{module.repo}</a>
                  ) : (
                    <span className="mono">{module.tag ? `${module.repo}@${module.tag}` : module.repo}</span>
                  )}
                </dd>
              </>
            )}
          </dl>
          <section>
            <h3 className="module-detail-heading">依赖</h3>
            {check.declared && check.items.length === 0 && <p className="module-detail-desc">没有需要先安装的模块。</p>}
            {check.declared && check.items.length > 0 && (
              <ul className="module-deps">
                {check.items.map((item) => {
                  const dependency = findCatalogModule(catalog, item.id);
                  const label = dependency ? moduleTitle(dependency) : item.id;
                  return (
                    <li key={item.id} className="module-dep">
                      <b className="truncate" title={item.id}>{label}</b>
                      {label !== item.id && <span className="mono">{item.id}</span>}
                      {item.status === "ready" && <Badge tone="success">已启用</Badge>}
                      {item.status === "disabled" && <Badge tone="warning">已停用</Badge>}
                      {item.status === "missing" && <Badge tone="danger">尚未安装</Badge>}
                      {item.status === "missing" && dependency && (
                        <Button size="sm" onClick={() => onOpenModule(dependency.id)}>查看</Button>
                      )}
                      {item.status === "missing" && !dependency && <span className="module-dep-hint">索引里没有这个模块，需要先把它装进实例。</span>}
                      {item.status === "disabled" && <Button size="sm" onClick={onShowInstalled}>去启用</Button>}
                    </li>
                  );
                })}
              </ul>
            )}
            {!listed && <p className="module-detail-desc">当前平台没有附带依赖名单，安装不会因为依赖被拒绝。</p>}
            {listed && !check?.declared && <p className="module-detail-desc">依赖名单格式不对，因此不能安装。</p>}
          </section>
        </div>
      )}
    </Sheet>
  );
}
