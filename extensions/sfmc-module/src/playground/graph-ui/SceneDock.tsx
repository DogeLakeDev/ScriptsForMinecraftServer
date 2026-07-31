import type { SceneSummary } from "./metaForm";

type SceneKind = "world" | "scoreboard" | "dimension" | "player" | "entity" | "item" | "block";

type SceneBlock = {
  id: string;
  kind: SceneKind;
  title: string;
  detail: string;
  group: string;
};

type SceneDockProps = {
  scene: SceneSummary | null;
  selectedId: string | null;
  onSelect: (objectId: string) => void;
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
  if (scene.scoreboard) {
    rows.push({
      id: scene.scoreboard.id,
      kind: "scoreboard",
      title: "Scoreboard",
      detail: scene.scoreboard.id,
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
      title: i.id,
      detail: "ItemStack",
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

export function SceneDock({ scene, selectedId, onSelect }: SceneDockProps) {
  if (!scene) {
    return (
      <div className="scene-dock">
        <div className="scene-dock-title">场景</div>
        <p className="muted scene-dock-empty">等待沙箱…</p>
      </div>
    );
  }

  const rows = buildBlocks(scene);
  let lastGroup = "";

  return (
    <div className="scene-dock">
      <div className="scene-dock-title">场景</div>
      <div className="scene-grid">
        {rows.map((r) => {
          const showGroup = r.group !== lastGroup;
          lastGroup = r.group;
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
