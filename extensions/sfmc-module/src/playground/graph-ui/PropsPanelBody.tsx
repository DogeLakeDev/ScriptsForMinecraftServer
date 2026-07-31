import {
  MetaPropForm,
  argsFromParamValues,
  eventProps,
  methodParamFields,
  playerCreateProps,
  seedArgsJson,
  seedProps,
  type MetaProp,
  type PlaygroundMeta,
  type SceneSummary,
} from "./metaForm";
import type { StimulusFlowNode, StimulusNodeData } from "./StimulusNode";
import { formatCallDetail } from "./StimulusNode";
import type { Edge } from "@xyflow/react";
import {
  ASSERT_KIND_OPTIONS,
  SCENE_KIND_OPTIONS,
  assertTitle,
  formatAssertDetail,
  normalizeAssertKind,
  type AssertKind,
} from "../graph/assert";
import { normalizeEdgeKind, type EdgeKind } from "../graph/order";
import { preferredPlayerObjectId } from "../graph/materialize";

type InspectSnap = { id: string; kind: string; props: Record<string, unknown> };

type Props = {
  meta: PlaygroundMeta | null;
  scene: SceneSummary | null;
  sideFocus: "graph" | "scene";
  selected: StimulusFlowNode | null;
  selectedEdge: Edge | null;
  inspect: InspectSnap | null;
  eventPaths: string[];
  playerFields: ReturnType<typeof playerCreateProps>;
  emitFields: ReturnType<typeof eventProps>;
  sceneFields: { name: string; readonly?: boolean; type?: string }[];
  patchNodeData: (id: string, patch: Partial<StimulusNodeData>) => void;
  patchEdgeLabel: (id: string, label: string) => void;
  patchEdgeKind: (id: string, kind: EdgeKind) => void;
  deleteNodesByIds: (ids: string[]) => void;
  deleteEdgesByIds: (ids: string[]) => void;
};

function sceneObjectOptions(scene: SceneSummary | null): { id: string; label: string }[] {
  if (!scene) return [];
  const out: { id: string; label: string }[] = [];
  if (scene.world) out.push({ id: scene.world.id, label: `World · ${scene.world.id}` });
  if (scene.scoreboard) {
    out.push({ id: scene.scoreboard.id, label: `Scoreboard · ${scene.scoreboard.id}` });
  }
  for (const d of scene.dimensions ?? []) {
    out.push({ id: d.id, label: `Dimension · ${d.dimensionId}` });
  }
  for (const p of scene.players ?? []) {
    out.push({ id: p.id, label: `Player · ${p.name}` });
  }
  for (const e of scene.entities ?? []) {
    out.push({ id: e.id, label: `Entity · ${e.typeId ?? e.id}` });
  }
  for (const i of scene.items ?? []) {
    out.push({ id: i.id, label: `ItemStack · ${i.id}` });
  }
  for (const b of scene.blocks ?? []) {
    out.push({ id: b.id, label: `Block · ${b.id}` });
  }
  return out;
}

function propNameOptions(meta: PlaygroundMeta | null, kind: string | undefined): string[] {
  if (!meta || !kind) return [];
  return (meta.classes[kind]?.properties ?? []).map((p) => p.name);
}

function patchAssert(
  selected: StimulusFlowNode,
  patch: Partial<StimulusNodeData>,
  patchNodeData: Props["patchNodeData"]
): void {
  const next = { ...selected.data, ...patch };
  const assertKind = normalizeAssertKind(next.assertKind);
  patchNodeData(selected.id, {
    ...patch,
    assertKind,
    title: assertTitle(assertKind),
    detail: formatAssertDetail({ ...next, assertKind }),
  });
}

function CallFields({
  selected,
  scene,
  meta,
  patchNodeData,
}: {
  selected: StimulusFlowNode;
  scene: SceneSummary | null;
  meta: PlaygroundMeta | null;
  patchNodeData: Props["patchNodeData"];
}) {
  const objects = sceneObjectOptions(scene);
  const targetKind =
    selected.data.targetKind ||
    objects.find((o) => o.id === selected.data.targetId)?.label.split(" · ")[0];
  const methodEntries =
    (targetKind && meta?.classes[targetKind]?.methods) ||
    ([] as { name: string; impl?: "l0" | "l2" }[]);
  // L2 在前，便于作者挑主路径；L0 标注「未接线」
  const methods = [...methodEntries].sort((a, b) => {
    const ai = a.impl === "l2" ? 0 : 1;
    const bi = b.impl === "l2" ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  const paramFields = methodParamFields(meta, targetKind, selected.data.method);

  const patchCall = (patch: Partial<StimulusNodeData>) => {
    const next = { ...selected.data, ...patch };
    const method = next.method || "?";
    patchNodeData(selected.id, {
      ...patch,
      title: method,
      detail: formatCallDetail(next),
    });
  };

  const paramValuesFromArgs = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(selected.data.argsJson || "[]");
      if (Array.isArray(parsed)) {
        paramFields.forEach((f, i) => {
          bag[f.name] = parsed[i] ?? defaultNull(f);
        });
        return seedProps(paramFields, bag);
      }
    } catch {
      /* ignore */
    }
    return seedProps(paramFields, {});
  };

  return (
    <>
      <p className="muted meta-hint">objects.call(目标, method, args) → 更新 lastCall</p>
      <div className="field">
        <label>目标对象</label>
        <select
          value={selected.data.targetId ?? ""}
          onChange={(e) => {
            const id = e.target.value || undefined;
            const label = objects.find((o) => o.id === id)?.label ?? "";
            const tk = label.split(" · ")[0];
            patchCall({
              targetId: id,
              targetKind: tk || selected.data.targetKind,
              method: undefined,
              argsJson: "[]",
            });
          }}
        >
          <option value="">（选择场景实例）</option>
          {objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>method</label>
        {methods.length ? (
          <select
            value={selected.data.method ?? ""}
            onChange={(e) => {
              const method = e.target.value || undefined;
              const nextKind =
                selected.data.targetKind ||
                objects.find((o) => o.id === selected.data.targetId)?.label.split(" · ")[0];
              patchCall({
                method,
                argsJson: seedArgsJson(meta, nextKind, method, "[]"),
              });
            }}
          >
            <option value="">（选择）</option>
            {methods.map((m) => (
              <option
                key={m.name}
                value={m.name}
                className={m.impl === "l0" ? "method-l0" : "method-l2"}
              >
                {m.impl === "l0" ? `${m.name} · 未接线` : m.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={selected.data.method ?? ""}
            placeholder="方法名"
            onChange={(e) => patchCall({ method: e.target.value || undefined })}
          />
        )}
      </div>
      {paramFields.length > 0 ? (
        <>
          <p className="muted meta-hint">形参来自 PLAYGROUND_META（1:1）</p>
          <MetaPropForm
            fields={paramFields}
            values={paramValuesFromArgs()}
            scene={scene}
            forceEditable
            onChange={(values) => {
              patchCall({ argsJson: JSON.stringify(argsFromParamValues(paramFields, values)) });
            }}
          />
        </>
      ) : (
        <div className="field">
          <label>args（JSON 数组）</label>
          <textarea
            rows={3}
            value={selected.data.argsJson ?? "[]"}
            placeholder='[] 或 ["hello", {"$ref":"p1"}]'
            onChange={(e) => patchCall({ argsJson: e.target.value })}
          />
        </div>
      )}
    </>
  );
}

function defaultNull(f: MetaProp): unknown {
  return f.type === "boolean" ? false : f.type === "number" ? 0 : f.type === "string" ? "" : null;
}

function AssertFields({
  selected,
  scene,
  meta,
  patchNodeData,
}: {
  selected: StimulusFlowNode;
  scene: SceneSummary | null;
  meta: PlaygroundMeta | null;
  patchNodeData: Props["patchNodeData"];
}) {
  const kind = normalizeAssertKind(selected.data.assertKind);
  const objects = sceneObjectOptions(scene);
  const targetKindGuess =
    selected.data.targetKind ||
    objects.find((o) => o.id === selected.data.targetId)?.label.split(" · ")[0];
  const propsList = propNameOptions(meta, targetKindGuess);

  return (
    <>
      <div className="field">
        <label>断言类型</label>
        <select
          value={kind}
          onChange={(e) =>
            patchAssert(selected, { assertKind: e.target.value as AssertKind }, patchNodeData)
          }
        >
          {ASSERT_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {(kind === "log" || kind === "logNot") && (
        <>
          <div className="field">
            <label>pattern</label>
            <input
              value={selected.data.pattern ?? ""}
              placeholder="子串或 /正则/flags"
              onChange={(e) => patchAssert(selected, { pattern: e.target.value }, patchNodeData)}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected.data.ignoreCase)}
                onChange={(e) =>
                  patchAssert(selected, { ignoreCase: e.target.checked }, patchNodeData)
                }
              />{" "}
              忽略大小写
            </label>
          </div>
        </>
      )}

      {(kind === "lastEmit" || kind === "lastCall") && (
        <>
          <p className="muted meta-hint">
            留空「字段」时用 pattern 搜 path/payload/result；填写字段则与期望值比较（支持 $id.prop /
            @lastEmit…）
          </p>
          <div className="field">
            <label>字段（可选）</label>
            <input
              value={selected.data.propName ?? ""}
              placeholder={
                kind === "lastEmit"
                  ? "path / payload.message / result.cancel"
                  : "id / method / result"
              }
              onChange={(e) =>
                patchAssert(selected, { propName: e.target.value || undefined }, patchNodeData)
              }
            />
          </div>
          {selected.data.propName ? (
            <>
              <div className="field">
                <label>匹配方式</label>
                <select
                  value={selected.data.matchMode ?? "equals"}
                  onChange={(e) =>
                    patchAssert(
                      selected,
                      { matchMode: e.target.value as StimulusNodeData["matchMode"] },
                      patchNodeData
                    )
                  }
                >
                  <option value="equals">等于</option>
                  <option value="contains">包含</option>
                  <option value="regex">正则</option>
                </select>
              </div>
              <div className="field">
                <label>期望值</label>
                <input
                  value={selected.data.expected ?? ""}
                  placeholder='字面量或 $id.prop / @lastCall.result'
                  onChange={(e) => patchAssert(selected, { expected: e.target.value }, patchNodeData)}
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label>pattern</label>
              <input
                value={selected.data.pattern ?? ""}
                placeholder="子串或 /正则/（搜 path·payload·result）"
                onChange={(e) => patchAssert(selected, { pattern: e.target.value }, patchNodeData)}
              />
            </div>
          )}
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected.data.ignoreCase)}
                onChange={(e) =>
                  patchAssert(selected, { ignoreCase: e.target.checked }, patchNodeData)
                }
              />{" "}
              忽略大小写
            </label>
          </div>
        </>
      )}

      {(kind === "sceneExists" || kind === "count") && (
        <>
          <div className="field">
            <label>kind</label>
            <select
              value={selected.data.targetKind ?? ""}
              onChange={(e) =>
                patchAssert(selected, { targetKind: e.target.value || undefined }, patchNodeData)
              }
            >
              <option value="">（任意）</option>
              {SCENE_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          {kind === "sceneExists" && (
            <>
              <div className="field">
                <label>name / typeId</label>
                <input
                  value={selected.data.targetName ?? ""}
                  placeholder="Player.name 或 Entity.typeId"
                  onChange={(e) =>
                    patchAssert(selected, { targetName: e.target.value || undefined }, patchNodeData)
                  }
                />
              </div>
              <div className="field">
                <label>对象 id</label>
                <select
                  value={selected.data.targetId ?? ""}
                  onChange={(e) =>
                    patchAssert(selected, { targetId: e.target.value || undefined }, patchNodeData)
                  }
                >
                  <option value="">（不限）</option>
                  {objects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {kind === "count" && (
            <>
              <div className="field">
                <label>比较</label>
                <select
                  value={selected.data.countOp ?? "eq"}
                  onChange={(e) =>
                    patchAssert(
                      selected,
                      { countOp: e.target.value as StimulusNodeData["countOp"] },
                      patchNodeData
                    )
                  }
                >
                  <option value="eq">等于 =</option>
                  <option value="gte">至少 ≥</option>
                  <option value="lte">至多 ≤</option>
                </select>
              </div>
              <div className="field">
                <label>N</label>
                <input
                  type="number"
                  value={selected.data.countN ?? 0}
                  onChange={(e) =>
                    patchAssert(selected, { countN: Number(e.target.value) || 0 }, patchNodeData)
                  }
                />
              </div>
            </>
          )}
        </>
      )}

      {kind === "prop" && (
        <>
          <div className="field">
            <label>目标对象</label>
            <select
              value={selected.data.targetId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const label = objects.find((o) => o.id === id)?.label ?? "";
                const tk = label.split(" · ")[0];
                patchAssert(
                  selected,
                  { targetId: id, targetKind: tk || selected.data.targetKind },
                  patchNodeData
                );
              }}
            >
              <option value="">（选择场景实例）</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>属性</label>
            {propsList.length ? (
              <select
                value={selected.data.propName ?? ""}
                onChange={(e) =>
                  patchAssert(selected, { propName: e.target.value || undefined }, patchNodeData)
                }
              >
                <option value="">（选择）</option>
                {propsList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={selected.data.propName ?? ""}
                placeholder="属性名"
                onChange={(e) =>
                  patchAssert(selected, { propName: e.target.value || undefined }, patchNodeData)
                }
              />
            )}
          </div>
          <div className="field">
            <label>匹配方式</label>
            <select
              value={selected.data.matchMode ?? "equals"}
              onChange={(e) =>
                patchAssert(
                  selected,
                  { matchMode: e.target.value as StimulusNodeData["matchMode"] },
                  patchNodeData
                )
              }
            >
              <option value="equals">等于</option>
              <option value="contains">包含</option>
              <option value="regex">正则</option>
            </select>
          </div>
          <div className="field">
            <label>期望值</label>
            <input
              value={selected.data.expected ?? ""}
              placeholder='字面量 / $id.prop / @lastEmit.payload.x'
              onChange={(e) => patchAssert(selected, { expected: e.target.value }, patchNodeData)}
            />
          </div>
          <p className="muted meta-hint">$ / @ 开头按表达式求值；否则整段字面量</p>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected.data.ignoreCase)}
                onChange={(e) =>
                  patchAssert(selected, { ignoreCase: e.target.checked }, patchNodeData)
                }
              />{" "}
              忽略大小写
            </label>
          </div>
        </>
      )}
    </>
  );
}

export function PropsPanelBody({
  meta,
  scene,
  sideFocus,
  selected,
  selectedEdge,
  inspect,
  eventPaths,
  playerFields,
  emitFields,
  sceneFields,
  patchNodeData,
  patchEdgeLabel,
  patchEdgeKind,
  deleteNodesByIds,
  deleteEdgesByIds,
}: Props) {
  if (sideFocus === "scene") {
    if (!inspect) {
      return <p className="muted">选中场景中的 World / Dimension / 实例</p>;
    }
    return (
      <>
        <div className="field">
          <label>id</label>
          <input value={inspect.id} readOnly />
        </div>
        <div className="field">
          <label>kind</label>
          <input value={inspect.kind} readOnly />
        </div>
        <p className="muted meta-hint">PLAYGROUND_META · inspect 快照（天生对象只读）</p>
        <MetaPropForm
          fields={sceneFields}
          values={inspect.props}
          onChange={() => undefined}
          scene={scene}
          readOnly
        />
      </>
    );
  }

  if (selectedEdge) {
    const note =
      String(selectedEdge.label ?? "").trim() ||
      String((selectedEdge.data as { note?: string } | undefined)?.note ?? "");
    const edgeKind = normalizeEdgeKind((selectedEdge.data as { kind?: string } | undefined)?.kind);
    return (
      <>
        <div className="field">
          <label>边 id</label>
          <input value={selectedEdge.id} readOnly />
        </div>
        <div className="field">
          <label>连接</label>
          <input value={`${selectedEdge.source} → ${selectedEdge.target}`} readOnly />
        </div>
        <div className="field">
          <label>边类型</label>
          <select
            value={edgeKind}
            onChange={(e) => patchEdgeKind(selectedEdge.id, e.target.value === "fail" ? "fail" : "pass")}
          >
            <option value="pass">通过边</option>
            <option value="fail">失败边</option>
          </select>
        </div>
        <p className="muted meta-hint">
          断言成功只走通过边；失败时若有失败边则转向其下游，否则停在该断言
        </p>
        <div className="field">
          <label>备注</label>
          <input
            value={note}
            placeholder="显示在连线上，不参与执行"
            onChange={(e) => patchEdgeLabel(selectedEdge.id, e.target.value)}
          />
        </div>
        <p className="muted meta-hint">拖动边端点可换连到其他节点；换连可撤回</p>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%", marginTop: 4 }}
          onClick={() => deleteEdgesByIds([selectedEdge.id])}
        >
          删除此边
        </button>
      </>
    );
  }

  if (!selected) {
    return <p className="muted">选中画布节点或边，或工具面板场景坞中的 World / 维度</p>;
  }

  return (
    <>
      <div className="field">
        <label>id</label>
        <input value={selected.id} readOnly />
      </div>
      <div className="field">
        <label>类型</label>
        <input value={selected.data.kind} readOnly />
      </div>
      {selected.data.kind === "player" && (
        <>
          <p className="muted meta-hint">
            {selected.data.objectId
              ? `已登记场景实例 ${selected.data.objectId}（可在场景坞 / $ref 中选用）`
              : "未实例化：打开或重置沙箱后会自动 objects.create；也可运行此节点"}
          </p>
          <p className="muted meta-hint">
            创建袋 = FakePlayerInit 入口 + Player/Entity 可写表面
          </p>
          <MetaPropForm
            fields={playerFields}
            values={seedProps(playerFields, selected.data.props)}
            scene={scene}
            onChange={(props) => {
              const name = String(props.name ?? selected.data.title);
              const dim = String(props.dimensionId ?? "minecraft:overworld");
              const id = preferredPlayerObjectId(props, name);
              patchNodeData(selected.id, {
                title: name,
                props: { ...props, id },
                objectId: undefined,
                detail: `${props.op ? "op" : "member"} · ${dim.replace(/^minecraft:/, "")}`,
              });
            }}
          />
        </>
      )}
      {selected.data.kind === "emit" && (
        <>
          <div className="field">
            <label>path</label>
            <select
              value={selected.data.path ?? ""}
              onChange={(e) => {
                const path = e.target.value;
                const fields = eventProps(meta, path);
                patchNodeData(selected.id, {
                  path,
                  title: path.split(".").pop(),
                  detail: path,
                  props: seedProps(fields, {}),
                });
              }}
            >
              {(eventPaths.length ? eventPaths : [selected.data.path ?? ""]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <p className="muted meta-hint">
            Event = {meta?.eventTypes[selected.data.path ?? ""]?.eventType ?? "?"} · 1:1 字段
          </p>
          {scene?.lastEmit?.path === (selected.data.path ?? "") && (
            <p className="muted meta-hint">
              上次 emit：{scene.lastEmit.listeners ?? 0} 个订阅回调
              {(scene.lastEmit.errors?.length ?? 0) > 0
                ? ` · ${scene.lastEmit.errors!.length} 个抛错（见日志）`
                : ""}
            </p>
          )}
          <MetaPropForm
            fields={emitFields}
            values={seedProps(emitFields, selected.data.props)}
            scene={scene}
            forceEditable
            onChange={(props) => patchNodeData(selected.id, { props })}
          />
        </>
      )}
      {selected.data.kind === "call" && (
        <CallFields selected={selected} scene={scene} meta={meta} patchNodeData={patchNodeData} />
      )}
      {selected.data.kind === "tick" && (
        <div className="field">
          <label>n</label>
          <input
            type="number"
            value={selected.data.n ?? 1}
            onChange={(e) => patchNodeData(selected.id, { n: Number(e.target.value) || 1 })}
          />
        </div>
      )}
      {selected.data.kind === "assert" && (
        <AssertFields
          selected={selected}
          scene={scene}
          meta={meta}
          patchNodeData={patchNodeData}
        />
      )}
      {selected.data.kind === "note" && (
        <div className="field">
          <label>文本</label>
          <textarea
            rows={4}
            value={selected.data.detail}
            onChange={(e) => patchNodeData(selected.id, { detail: e.target.value })}
          />
        </div>
      )}
      <button
        type="button"
        className="btn-secondary"
        style={{ width: "100%", marginTop: 4 }}
        onClick={() => deleteNodesByIds([selected.id])}
      >
        删除此节点
      </button>
    </>
  );
}

export function HotkeysPanelBody({ mod }: { mod: string }) {
  return (
    <ul className="hotkey-list">
      <li>
        <span>撤回 / 重做</span>
        <span className="rdx-kbd">
          {mod}+Z / {mod}+Y
        </span>
      </li>
      <li>
        <span>运行整图</span>
        <span className="rdx-kbd">F5</span>
      </li>
      <li>
        <span>从选中运行</span>
        <span className="rdx-kbd">{mod}+F5</span>
      </li>
      <li>
        <span>仅运行选中</span>
        <span className="rdx-kbd">{mod}+Enter</span>
      </li>
      <li>
        <span>重置场景</span>
        <span className="rdx-kbd">{mod}+Shift+R</span>
      </li>
      <li>
        <span>保存 / 打开</span>
        <span className="rdx-kbd">
          {mod}+S / {mod}+O
        </span>
      </li>
      <li>
        <span>复制 / 删除</span>
        <span className="rdx-kbd">{mod}+D / Del</span>
      </li>
      <li>
        <span>插入节点</span>
        <span className="rdx-kbd">{mod}+1…6</span>
      </li>
    </ul>
  );
}
