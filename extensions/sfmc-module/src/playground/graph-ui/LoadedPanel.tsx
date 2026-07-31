import { Codicon } from "./Codicon";
import type { ModuleBinding } from "./metaForm";

type LoadedPanelProps = {
  binding: ModuleBinding;
  onInsertEmit: (eventPath: string) => void;
};

const LEVEL_LABEL: Record<number, string> = {
  0: "Any",
  1: "Member",
  2: "OP",
  3: "Admin",
};

function levelLabel(level: number): string {
  return LEVEL_LABEL[level] ?? String(level);
}

function shortRoot(root: string | null | undefined): string {
  if (!root || root === "(engine only)") return root ?? "—";
  return root.replace(/\\/g, "/");
}

function EmptyRow({ text }: { text: string }) {
  return <p className="muted loaded-empty">{text}</p>;
}

/** 沙箱已装载清单：模块身份、事件、命令、权限、boot 分相 */
export function LoadedPanel({ binding, onInsertEmit }: LoadedPanelProps) {
  const pending = binding.status === "pending";
  const engineOnly = !binding.id && binding.status !== "pending";
  const events = binding.subscribedEvents ?? [];
  const commands = binding.commands;
  const permissions = binding.permissions;
  const boot = binding.bootPhase;

  return (
    <div className="loaded-panel">
      <div className="loaded-section">
        <div className="loaded-section-title">
          <Codicon name="package" />
          模块
        </div>
        {pending ? (
          <EmptyRow text="装载中…" />
        ) : (
          <>
            <div className="loaded-row">
              <span className="loaded-key">id</span>
              <span className="loaded-val" title={binding.id ?? undefined}>
                {binding.id ?? (engineOnly ? "(engine only)" : "—")}
              </span>
            </div>
            <div className="loaded-row">
              <span className="loaded-key">version</span>
              <span className="loaded-val">{binding.version ?? "—"}</span>
            </div>
            <div className="loaded-row">
              <span className="loaded-key">moduleRoot</span>
              <span className="loaded-val mono" title={shortRoot(binding.moduleRoot)}>
                {shortRoot(binding.moduleRoot)}
              </span>
            </div>
            <div className="loaded-row">
              <span className="loaded-key">enabled</span>
              <span className="loaded-val">
                {binding.enabled === true ? "是" : binding.enabled === false ? "否" : "—"}
              </span>
            </div>
            {binding.afterWorldLoad != null ? (
              <div className="loaded-row">
                <span className="loaded-key">afterWorldLoad</span>
                <span className="loaded-val">{binding.afterWorldLoad ? "是" : "否"}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="loaded-section">
        <div className="loaded-section-title">
          <Codicon name="debug-start" />
          boot 分相
        </div>
        {boot ? (
          <p className="loaded-phase">{boot.summary}</p>
        ) : (
          <EmptyRow text="不可枚举" />
        )}
      </div>

      <div className="loaded-section">
        <div className="loaded-section-title">
          <Codicon name="bell" />
          已订阅事件
          <span className="loaded-count">{events.length}</span>
        </div>
        {events.length === 0 ? (
          <EmptyRow text={engineOnly ? "无模块事件订阅" : "暂无已订阅 path"} />
        ) : (
          <ul className="loaded-list">
            {events.map((e) => (
              <li key={e.path} className="loaded-list-item">
                <span className="loaded-item-main mono" title={e.path}>
                  {e.path}
                  <span className="muted"> ×{e.listeners}</span>
                </span>
                <button
                  type="button"
                  className="btn ghost loaded-emit-btn"
                  title="插入 Emit 节点"
                  onClick={() => onInsertEmit(e.path)}
                >
                  插入 Emit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="loaded-section">
        <div className="loaded-section-title">
          <Codicon name="terminal" />
          已注册命令
          <span className="loaded-count">
            {commands?.enumerable === false
              ? "—"
              : (commands?.items?.length ?? 0)}
          </span>
        </div>
        {commands?.enumerable === false ? (
          <EmptyRow text="不可枚举" />
        ) : (commands?.items?.length ?? 0) === 0 ? (
          <EmptyRow text="无已注册命令" />
        ) : (
          <ul className="loaded-list">
            {(commands?.items ?? []).map((c) => (
              <li key={c.name} className="loaded-list-item">
                <span className="loaded-item-main" title={c.description}>
                  <span className="mono">!{c.name}</span>
                  {c.description && c.description !== c.name ? (
                    <span className="muted"> · {c.description}</span>
                  ) : null}
                </span>
                {c.permission !== undefined ? (
                  <span className="loaded-tag muted">
                    {typeof c.permission === "number"
                      ? levelLabel(c.permission)
                      : c.permission}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="loaded-section">
        <div className="loaded-section-title">
          <Codicon name="shield" />
          已注册权限
          <span className="loaded-count">
            {permissions?.enumerable === false
              ? "—"
              : (permissions?.items?.length ?? 0)}
          </span>
        </div>
        {permissions?.enumerable === false ? (
          <EmptyRow text="不可枚举" />
        ) : (permissions?.items?.length ?? 0) === 0 ? (
          <EmptyRow text="无已注册命名权限" />
        ) : (
          <>
            {permissions?.note ? <p className="muted loaded-hint">{permissions.note}</p> : null}
            <ul className="loaded-list">
              {(permissions?.items ?? []).map((p) => (
                <li key={p.name} className="loaded-list-item">
                  <span className="loaded-item-main mono">{p.name}</span>
                  <span className="loaded-tag muted">
                    {levelLabel(p.level)} ({p.level})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
