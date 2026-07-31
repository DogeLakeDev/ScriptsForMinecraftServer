import { useEffect, useState } from "react";
import type { ModuleBinding } from "./metaForm";

export type FixtureSnapshot = {
  module: { id: string; root?: string } | null;
  moduleRoot: string | null;
  enabled: boolean | null;
  configs: {
    settings?: Record<string, unknown>;
    permissions?: Array<{ player_name: string; level: number }>;
    modules?: Array<{ id?: string; enabled?: boolean }>;
  };
  intent: {
    settings?: Record<string, unknown>;
    permissions?: Array<{ player_name: string; level: number }>;
    treatPlayersAsOp?: boolean;
    enabled?: boolean;
    clearDb?: boolean;
  };
  dbCallCount: number;
  note: string;
};

type FixturePanelProps = {
  ready: boolean;
  busy: boolean;
  moduleBinding: ModuleBinding;
  fixture: FixtureSnapshot | null;
  onApply: (intent: FixtureSnapshot["intent"]) => Promise<void>;
  onClearDb: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

const LEVEL_OPTS = [
  { value: 0, label: "Any (0)" },
  { value: 1, label: "Member (1)" },
  { value: 2, label: "OP (2)" },
  { value: 3, label: "Admin (3)" },
];

function settingsToText(settings: Record<string, unknown> | undefined): string {
  try {
    return JSON.stringify(settings ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export function FixturePanel({
  ready,
  busy,
  moduleBinding,
  fixture,
  onApply,
  onClearDb,
  onRefresh,
}: FixturePanelProps) {
  const [settingsText, setSettingsText] = useState("{}");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [treatOp, setTreatOp] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [permName, setPermName] = useState("");
  const [permLevel, setPermLevel] = useState(2);
  const [permissions, setPermissions] = useState<Array<{ player_name: string; level: number }>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!fixture) return;
    setSettingsText(settingsToText(fixture.intent.settings ?? fixture.configs.settings));
    setTreatOp(!!fixture.intent.treatPlayersAsOp);
    setEnabled(fixture.intent.enabled ?? fixture.enabled !== false);
    setPermissions(
      fixture.intent.permissions ??
        fixture.configs.permissions ??
        []
    );
    setSettingsError(null);
  }, [fixture]);

  const rootLabel = (fixture?.moduleRoot ?? moduleBinding.moduleRoot ?? "(engine only)")
    .replace(/\\/g, "/");
  const moduleId = fixture?.module?.id ?? moduleBinding.id ?? "—";

  const apply = async (extra?: Partial<FixtureSnapshot["intent"]>) => {
    setMsg(null);
    let settings: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(settingsText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("settings 须为 JSON 对象");
      }
      settings = parsed as Record<string, unknown>;
      setSettingsError(null);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setSettingsError(err);
      return;
    }
    await onApply({
      settings,
      permissions,
      treatPlayersAsOp: treatOp,
      enabled,
      ...extra,
    });
    setMsg("已应用夹具");
  };

  return (
    <div className="fixture-panel">
      <div className="fixture-section">
        <div className="fixture-section-title">当前模块</div>
        <div className="fixture-row">
          <span className="fixture-key">id</span>
          <span className="fixture-val" title={moduleId}>
            {moduleId}
          </span>
        </div>
        <div className="fixture-row">
          <span className="fixture-key">root</span>
          <span className="fixture-val mono" title={rootLabel}>
            {rootLabel.split("/").slice(-2).join("/") || rootLabel}
          </span>
        </div>
        <div className="fixture-row">
          <span className="fixture-key">enabled</span>
          <label className="fixture-check">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!ready || busy || !fixture?.module}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>{enabled ? "启用" : "禁用"}</span>
          </label>
        </div>
        <p className="muted fixture-hint">
          切换 enabled 只刷新 ConfigManager 启停缓存；完整重装请「重置场景」。
        </p>
      </div>

      <div className="fixture-section">
        <div className="fixture-section-title">配置覆盖（settings）</div>
        <textarea
          className="fixture-json"
          spellCheck={false}
          value={settingsText}
          disabled={!ready || busy}
          onChange={(e) => setSettingsText(e.target.value)}
          rows={8}
        />
        {settingsError ? <div className="fixture-error">{settingsError}</div> : null}
      </div>

      <div className="fixture-section">
        <div className="fixture-section-title">权限</div>
        <label className="fixture-check">
          <input
            type="checkbox"
            checked={treatOp}
            disabled={!ready || busy}
            onChange={(e) => setTreatOp(e.target.checked)}
          />
          <span>场景玩家视为 OP</span>
        </label>
        <div className="fixture-perm-add">
          <input
            className="fixture-input"
            placeholder="玩家名"
            value={permName}
            disabled={!ready || busy}
            onChange={(e) => setPermName(e.target.value)}
          />
          <select
            className="fixture-select"
            value={permLevel}
            disabled={!ready || busy}
            onChange={(e) => setPermLevel(Number(e.target.value))}
          >
            {LEVEL_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn compact"
            disabled={!ready || busy || !permName.trim()}
            onClick={() => {
              const name = permName.trim();
              if (!name) return;
              setPermissions((prev) => {
                const next = prev.filter((p) => p.player_name !== name);
                next.push({ player_name: name, level: permLevel });
                return next;
              });
              setPermName("");
            }}
          >
            添加
          </button>
        </div>
        {permissions.length > 0 ? (
          <ul className="fixture-perm-list">
            {permissions.map((p) => (
              <li key={p.player_name}>
                <span>
                  {p.player_name} · {LEVEL_OPTS.find((o) => o.value === p.level)?.label ?? p.level}
                </span>
                <button
                  type="button"
                  className="btn compact ghost"
                  disabled={!ready || busy}
                  onClick={() =>
                    setPermissions((prev) => prev.filter((x) => x.player_name !== p.player_name))
                  }
                >
                  删
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted fixture-hint">无具名覆盖；可勾选「视为 OP」或按名添加。</p>
        )}
      </div>

      <div className="fixture-section">
        <div className="fixture-section-title">假 DB</div>
        <p className="muted fixture-hint">
          调用日志 {fixture?.dbCallCount ?? 0} 条。完整种子请用测试代码{" "}
          <code>{`createSandbox({ db: { provides } })`}</code>。
        </p>
        <button
          type="button"
          className="btn compact"
          disabled={!ready || busy}
          onClick={() => void onClearDb().then(() => setMsg("已清空假 DB 日志"))}
        >
          清空 DB 日志
        </button>
      </div>

      <div className="fixture-actions">
        <button
          type="button"
          className="btn compact primary"
          disabled={!ready || busy}
          onClick={() => void apply()}
        >
          应用夹具
        </button>
        <button
          type="button"
          className="btn compact"
          disabled={!ready || busy}
          onClick={() => void apply().then(() => setMsg("已重新应用夹具"))}
          title="把当前编辑写回沙箱（重置后意图仍保留，也可点此再刷）"
        >
          重新应用
        </button>
        <button
          type="button"
          className="btn compact ghost"
          disabled={!ready || busy}
          onClick={() => void onRefresh()}
        >
          刷新
        </button>
      </div>
      {msg ? <div className="fixture-msg">{msg}</div> : null}
      {fixture?.note ? <p className="muted fixture-hint">{fixture.note}</p> : null}
    </div>
  );
}
