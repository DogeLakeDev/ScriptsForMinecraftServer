import { useState } from "react";
import type { SceneSummary } from "./metaForm";
import { SpreadsheetView, type SpreadsheetColumn, type SpreadsheetRow, type SpreadsheetTable } from "./SpreadsheetView";

type SceneKind = "world" | "scoreboard" | "dimension" | "player" | "entity" | "item" | "block";

type SceneBlock = {
  id: string;
  kind: SceneKind;
  title: string;
  detail: string;
  group: string;
};

export type ChatLine = {
  t: number;
  direction: "say" | "system";
  text: string;
};

type SceneDockProps = {
  scene: SceneSummary | null;
  selectedId: string | null;
  onSelect: (objectId: string) => void;
  /** 可选：按玩家名路由的迷你聊天日志（playerName → ChatLine[]）。不传则不展示。 */
  chatByPlayer?: Record<string, ChatLine[]>;
};

const KIND_HEAD: Record<SceneKind, string> = {
  world: "World",
  scoreboard: "Scoreboard",
  dimension: "Dimension",
  player: "Player",
  entity: "Entity",
  item: "ItemStack",
  block: "Block",
};

function buildBlocks(scene: SceneSummary): SceneBlock[] {
  const rows: SceneBlock[] = [];
  if (scene.world) {
    rows.push({
      id: scene.world.id,
      kind: "world",
      title: "World",
      detail: scene.world.id,
      group: "天生",
    });
  }
  for (const d of scene.dimensions ?? []) {
    const short = d.dimensionId.replace(/^minecraft:/, "");
    rows.push({
      id: d.id,
      kind: "dimension",
      title: short,
      detail: d.id,
      group: "天生",
    });
  }
  if (scene.scoreboard) {
    rows.push({
      id: scene.scoreboard.id,
      kind: "scoreboard",
      title: "Scoreboard",
      detail: scene.scoreboard.id,
      group: "实例",
    });
  }
  for (const p of scene.players ?? []) {
    rows.push({
      id: p.id,
      kind: "player",
      title: p.name,
      detail: p.id,
      group: "实例",
    });
  }
  for (const e of scene.entities ?? []) {
    rows.push({
      id: e.id,
      kind: "entity",
      title: e.typeId ?? e.id,
      detail: e.id,
      group: "实例",
    });
  }
  for (const i of scene.items ?? []) {
    rows.push({
      id: i.id,
      kind: "item",
      title: i.typeId ?? i.id,
      detail: i.id,
      group: "实例",
    });
  }
  for (const b of scene.blocks ?? []) {
    rows.push({
      id: b.id,
      kind: "block",
      title: b.id,
      detail: "Block",
      group: "实例",
    });
  }
  return rows;
}

function spreadsheetColumn(key: string, label = key): SpreadsheetColumn {
  const path = key.split(".");
  return {
    key,
    label,
    value: (row) =>
      path.reduce<unknown>((value, segment) => {
        if (!value || typeof value !== "object") return undefined;
        return (value as Record<string, unknown>)[segment];
      }, row),
  };
}

function spreadsheetRows(rows: unknown[] | undefined): SpreadsheetRow[] {
  return (rows ?? []).filter((row): row is SpreadsheetRow =>
    Boolean(row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string")
  );
}

function buildSpreadsheetTables(scene: SceneSummary): SpreadsheetTable[] {
  const id = spreadsheetColumn("id");
  const location = [spreadsheetColumn("location.x"), spreadsheetColumn("location.y"), spreadsheetColumn("location.z")];
  return [
    {
      key: "player",
      title: "Player",
      rows: spreadsheetRows(scene.players),
      columns: [id, spreadsheetColumn("name"), ...location, spreadsheetColumn("isOp")],
    },
    {
      key: "entity",
      title: "Entity",
      rows: spreadsheetRows(scene.entities),
      columns: [id, spreadsheetColumn("typeId"), ...location, spreadsheetColumn("health")],
    },
    {
      key: "item",
      title: "ItemStack",
      rows: spreadsheetRows(scene.items),
      columns: [id, spreadsheetColumn("typeId"), spreadsheetColumn("amount"), ...location],
    },
    {
      key: "block",
      title: "Block",
      rows: spreadsheetRows(scene.blocks),
      columns: [id, spreadsheetColumn("typeId"), ...location],
    },
    {
      key: "dimension",
      title: "Dimension",
      rows: spreadsheetRows(scene.dimensions),
      columns: [id, spreadsheetColumn("dimensionId")],
    },
    {
      key: "world",
      title: "World",
      rows: spreadsheetRows(scene.world ? [scene.world] : []),
      columns: [id],
    },
    {
      key: "scoreboard",
      title: "Scoreboard",
      rows: spreadsheetRows(scene.scoreboard ? [scene.scoreboard] : []),
      columns: [id],
    },
  ];
}

function BlockSceneView({ scene, selectedId, onSelect, chatByPlayer }: SceneDockProps & { scene: SceneSummary }) {
  const rows = buildBlocks(scene);
  let lastGroup = "";
  const players = scene.players ?? [];

  return (
    <>
      <div className="scene-grid">
        {rows.map((r) => {
          const showGroup = r.group !== lastGroup;
          lastGroup = r.group;
          const chatLines =
            r.kind === "player" && chatByPlayer ? (chatByPlayer[r.title] ?? chatByPlayer[r.detail] ?? []) : [];
          return (
            <div key={r.id} className="scene-grid-cell">
              {showGroup ? <div className="scene-group">{r.group}</div> : null}
              <button
                type="button"
                className={`scene-block s-node${selectedId === r.id ? " selected" : ""}`}
                data-kind={r.kind}
                onClick={() => onSelect(r.id)}
              >
                <div className="s-node-head">
                  <span className="dot" />
                  <span>{KIND_HEAD[r.kind]}</span>
                </div>
                <div className="s-node-body">
                  <div>{r.title}</div>
                  <div className="mt-1 opacity-85">{r.detail}</div>
                </div>
              </button>
              {chatLines.length > 0 ? (
                <div className="mini-chat" aria-label={`${r.title} 聊天日志`}>
                  {chatLines.slice(-6).map((line, idx) => (
                    <div
                      key={`${line.t}-${idx}`}
                      className={`mini-chat-line mini-chat-${line.direction}`}
                      title={new Date(line.t).toLocaleTimeString()}
                    >
                      {line.direction === "system" ? "→ " : ""}
                      {line.text}
                    </div>
                  ))}
                  {chatLines.length > 6 ? <div className="mini-chat-more">… 还有 {chatLines.length - 6} 条</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {players.length === 0 && chatByPlayer && Object.keys(chatByPlayer).length > 0 ? (
        <div className="mini-chat-mini" aria-label="未注册玩家聊天">
          {Object.entries(chatByPlayer).map(([name, lines]) => (
            <div key={name} className="mini-chat-block">
              <div className="mini-chat-name">{name}</div>
              {lines.slice(-6).map((l, i) => (
                <div
                  key={`${l.t}-${i}`}
                  className={`mini-chat-line mini-chat-${l.direction}`}
                  title={new Date(l.t).toLocaleTimeString()}
                >
                  {l.direction === "system" ? "→ " : ""}
                  {l.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function SceneDock(props: SceneDockProps) {
  const [view, setView] = useState<"blocks" | "spreadsheet">("blocks");
  const { scene } = props;

  return (
    <div className="scene-dock">
      <div className="scene-dock-heading">
        <div className="scene-dock-title">场景</div>
        <div className="scene-view-tabs" role="tablist" aria-label="场景视图">
          <button
            type="button"
            role="tab"
            aria-selected={view === "blocks"}
            className={view === "blocks" ? "active" : ""}
            onClick={() => setView("blocks")}
          >
            块状
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "spreadsheet"}
            className={view === "spreadsheet" ? "active" : ""}
            onClick={() => setView("spreadsheet")}
          >
            表格
          </button>
        </div>
      </div>
      {!scene ? (
        <p className="muted scene-dock-empty">等待沙箱…</p>
      ) : view === "blocks" ? (
        <BlockSceneView {...props} scene={scene} />
      ) : (
        <SpreadsheetView tables={buildSpreadsheetTables(scene)} />
      )}
    </div>
  );
}
