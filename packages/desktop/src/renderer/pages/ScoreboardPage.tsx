/**
 * ScoreboardPage.tsx — 计分板
 *
 * 使用场景：查看并编辑世界计分板。左侧为计分项列表（可搜索、新建），右侧为选中计分项的
 * 统计（参与者数、总分、平均、中位数、最高、最低）、分数排行与分布图，以及参与者列表（搜索、排序、改分、重置、添加参与者、删除计分项）。
 * 数据来自 scoreboard.read：游戏内平台脚本在有人查看时把计分板同步到数据服务，本页打开期间定时刷新以保持同步。
 * 编辑经 scoreboard.apply 转成 BDS 控制台命令执行，执行后带 after 参数重新读取以显示新分数。
 * 离线玩家与非玩家实体无法被控制台命令定位，对应行的编辑按钮禁用并说明原因（规则见 @sfmc-bds/management 的 scoreboardTargetBlock）。
 * 握手带 "scoreboard" 能力时才显示本页。
 */
import {
  scoreboardCommand,
  scoreboardTargetBlock,
  type ScoreboardObjectiveRow,
  type ScoreboardOperation,
  type ScoreboardParticipant,
  type ScoreboardReadResult,
  type ScoreboardScoreMode,
} from "@sfmc-bds/management";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasCapability } from "../../shared/platform-next.js";
import { useDesktop } from "../app/desktop.js";
import { Button, Field, IconButton, NumberInput, SearchInput, Segmented, Select, TextInput } from "../components/controls.js";
import { toast, useConfirm } from "../components/feedback.js";
import { Modal } from "../components/overlays.js";
import { Avatar, Badge, Callout, EmptyState, PageHeader, Surface } from "../components/ui.js";
import { cx } from "../lib/cx.js";
import { errorText, hashHue, relativeTime } from "../lib/format.js";
import {
  binLabel,
  filterParticipants,
  formatScore,
  formatStat,
  objectiveFormError,
  objectiveSlots,
  objectiveTitle,
  participantName,
  participantTag,
  previewScore,
  SCORE_MODES,
  scoreForm,
  scoreHistogram,
  scoreRanking,
  SCOREBOARD_SORTS,
  scoreStats,
  sortParticipants,
  type ScoreboardSort,
} from "../lib/scoreboard.js";

/** 页面打开期间的刷新间隔；需短于数据服务的关注期（30 秒），游戏内脚本才会持续同步 */
const POLL_MS = 5_000;
/** 排行图显示的名次数 */
const RANK_ROWS = 10;
/** 分布图的最多柱数 */
const HISTOGRAM_BINS = 12;
/** 参与者列表每次多显示的行数 */
const LIST_STEP = 200;

/** 分数对话框的状态：修改已有参与者，或向计分项添加新参与者 */
type ScoreDialogState = { objective: ScoreboardObjectiveRow; participant: ScoreboardParticipant | null } | null;

/** 新建计分项对话框 */
function ObjectiveDialog({ open, objectives, onClose, onSubmit }: { open: boolean; objectives: readonly ScoreboardObjectiveRow[]; onClose: () => void; onSubmit: (operation: ScoreboardOperation) => Promise<void> }) {
  const [id, setId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setId("");
    setDisplayName("");
    setSubmitted(false);
  }, [open]);
  const operation: ScoreboardOperation = { op: "objective.add", objective: id, ...(displayName.trim() ? { displayName } : {}) };
  const error = objectiveFormError(objectives, operation);
  const commit = async () => {
    setSubmitted(true);
    if (error) return;
    setSaving(true);
    try {
      await onSubmit(operation);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="sm"
      icon="plus"
      title="新建计分项"
      description="以 dummy 准则创建，分数只能通过命令或脚本修改"
      onSubmit={() => void commit()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" type="submit" loading={saving}>创建</Button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="计分项 ID" required error={submitted ? error : undefined} description="命令中使用的名称，例如 kills">
          <TextInput mono value={id} onChange={setId} placeholder="kills" autoFocus invalid={submitted && Boolean(error)} />
        </Field>
        <Field label="显示名称" description="可选，留空时显示 ID；支持 § 格式码">
          <TextInput value={displayName} onChange={setDisplayName} placeholder="击杀数" />
        </Field>
        {!error && <pre className="code-block scoreboard-command">/{scoreboardCommand(operation)}</pre>}
      </div>
    </Modal>
  );
}

/** 修改分数 / 添加参与者对话框 */
function ScoreDialog({ state, onClose, onSubmit }: { state: ScoreDialogState; onClose: () => void; onSubmit: (operation: ScoreboardOperation) => Promise<void> }) {
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<ScoreboardScoreMode>("set");
  const [value, setValue] = useState<number | null>(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!state) return;
    setTarget("");
    setMode("set");
    setValue(state.participant?.score ?? 0);
    setSubmitted(false);
  }, [state]);
  /** 切换修改方式时换掉输入值：“设为”回到当前分数，“增加/减少”从步长 1 开始，避免把绝对分数误当增量 */
  const changeMode = (next: ScoreboardScoreMode) => {
    setMode(next);
    setValue(next === "set" ? (state?.participant?.score ?? 0) : 1);
    setSubmitted(false);
  };
  if (!state) return null;
  const { objective, participant } = state;
  const adding = participant === null;
  const { operation, error } = scoreForm(objective, participant, mode, target, value);
  const current = participant?.score ?? 0;
  const commit = async () => {
    setSubmitted(true);
    if (error) return;
    setSaving(true);
    try {
      await onSubmit(operation);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="sm"
      icon={adding ? "plus" : "pencil"}
      title={adding ? "添加参与者" : `修改 ${participantName(participant)} 的分数`}
      description={`计分项：${objectiveTitle(objective)}`}
      onSubmit={() => void commit()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" type="submit" loading={saving}>{adding ? "添加" : "保存"}</Button>
        </>
      }
    >
      <div className="form-stack">
        {adding && (
          <Field label="参与者名称" required description="在线玩家的名字，或任意虚拟玩家名（如 #总计）">
            <TextInput value={target} onChange={setTarget} placeholder="Steve" autoFocus invalid={submitted && Boolean(error)} />
          </Field>
        )}
        {!adding && <Segmented size="sm" label="修改方式" value={mode} onChange={changeMode} options={SCORE_MODES.map((row) => ({ value: row.value, label: row.label }))} />}
        <Field label={mode === "set" ? "分数" : mode === "add" ? "增加" : "减少"} required error={submitted ? error : undefined}>
          <NumberInput label="分数" integer value={value} onChange={setValue} min={mode === "set" ? undefined : 0} invalid={submitted && Boolean(error)} />
        </Field>
        {!adding && value !== null && (
          <p className="muted scoreboard-preview">
            <span className="mono">{formatScore(current)}</span>
            <span>→</span>
            <b className="mono">{formatScore(previewScore(current, mode, value))}</b>
          </p>
        )}
        {!error && <pre className="code-block scoreboard-command">/{scoreboardCommand(operation)}</pre>}
      </div>
    </Modal>
  );
}

/** 统计、排行与分布 */
function ObjectiveCharts({ objective }: { objective: ScoreboardObjectiveRow }) {
  const stats = useMemo(() => scoreStats(objective.participants), [objective]);
  const ranking = useMemo(() => scoreRanking(objective.participants, RANK_ROWS), [objective]);
  const histogram = useMemo(() => scoreHistogram(objective.participants, HISTOGRAM_BINS), [objective]);
  return (
    <>
      <div className="scoreboard-stats">
        <div className="activity-stat"><span>参与者</span><b className="mono">{formatStat(stats.count)}</b></div>
        <div className="activity-stat"><span>总分</span><b className="mono">{formatStat(stats.sum)}</b></div>
        <div className="activity-stat"><span>平均</span><b className="mono">{formatStat(stats.mean)}</b></div>
        <div className="activity-stat"><span>中位数</span><b className="mono">{formatStat(stats.median)}</b></div>
        <div className="activity-stat"><span>最高</span><b className="mono">{formatStat(stats.max)}</b></div>
        <div className="activity-stat"><span>最低</span><b className="mono">{formatStat(stats.min)}</b></div>
      </div>
      {stats.count > 0 && (
        <div className="activity-breakdown">
          <div>
            <div className="task-result-label">排行前 {Math.min(RANK_ROWS, stats.count)}</div>
            <ul className="activity-bars">
              {ranking.map((row) => {
                const name = participantName(row.participant);
                return (
                  <li key={row.participant.id} className="scoreboard-rank">
                    <span className="mono muted">{row.rank}</span>
                    <span className="truncate" title={name}>{name}</span>
                    <span className="activity-bar-track"><span className={cx(row.participant.score < 0 && "negative")} style={{ width: `${row.ratio}%` }} /></span>
                    <span className="mono">{formatScore(row.participant.score)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <div className="task-result-label">分数分布</div>
            <div className="scoreboard-histogram" role="img" aria-label="分数分布">
              {histogram.map((bin) => (
                <div key={bin.from} className="scoreboard-column" title={`${binLabel(bin)}：${bin.count} 名`}>
                  <span className="scoreboard-column-count mono">{bin.count || ""}</span>
                  <span className="scoreboard-column-bar" style={{ height: `${Math.max(bin.count ? 4 : 0, bin.ratio)}%` }} />
                </div>
              ))}
            </div>
            {histogram.length > 0 && (
              <div className="scoreboard-histogram-axis mono muted">
                <span>{formatScore(histogram[0]!.from)}</span>
                <span>{formatScore(histogram[histogram.length - 1]!.to)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ScoreboardPage() {
  const { model, editable, request } = useDesktop();
  const confirm = useConfirm();
  /** 切换实例时本页可能先于握手结果挂载；能力未就绪时不发请求（同行为日志页） */
  const supported = hasCapability(model.handshake?.capabilities, "scoreboard");
  const [result, setResult] = useState<ScoreboardReadResult>();
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objectiveKeyword, setObjectiveKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<ScoreboardSort>("score-desc");
  const [visible, setVisible] = useState(LIST_STEP);
  const [creating, setCreating] = useState(false);
  const [scoreDialog, setScoreDialog] = useState<ScoreDialogState>(null);
  const [now, setNow] = useState(Date.now());
  const seq = useRef(0);
  /** 进行中的读取数；后台轮询在有读取未完成时跳过，以免顶掉编辑后等待新快照的那次读取 */
  const inflight = useRef(0);

  /** 读取快照；after 用于编辑后等待新快照。silent 时失败不弹提示（后台轮询） */
  const load = useCallback(async (options: { after?: number; silent?: boolean } = {}) => {
    const current = ++seq.current;
    if (!supported) return;
    if (!options.silent) setLoading(true);
    inflight.current++;
    try {
      const value = await request("scoreboard.read", options.after === undefined ? {} : { after: options.after });
      if (current === seq.current) setResult(value);
    } catch (error) {
      if (current === seq.current && !options.silent) toast.error("读取计分板失败", errorText(error));
    } finally {
      inflight.current--;
      if (current === seq.current) setLoading(false);
    }
  }, [request, supported]);

  useEffect(() => {
    if (!supported) {
      seq.current++;
      setLoading(false);
      return;
    }
    void load();
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && inflight.current === 0) void load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, supported]);

  const objectives = useMemo(() => result?.objectives ?? [], [result]);
  const shownObjectives = useMemo(() => {
    const text = objectiveKeyword.trim().toLowerCase();
    const list = [...objectives].sort((a, b) => objectiveTitle(a).localeCompare(objectiveTitle(b), "zh-CN"));
    return text ? list.filter((row) => row.id.toLowerCase().includes(text) || objectiveTitle(row).toLowerCase().includes(text)) : list;
  }, [objectives, objectiveKeyword]);
  // 选中项被删除或首次载入时，选中排序后的第一个计分项
  const selected = objectives.find((row) => row.id === selectedId) ?? shownObjectives[0] ?? null;
  useEffect(() => setVisible(LIST_STEP), [selected?.id, keyword, sort]);
  const participants = useMemo(
    () => (selected ? sortParticipants(filterParticipants(selected.participants, keyword), sort) : []),
    [selected, keyword, sort]
  );

  /** 下发编辑操作，成功后等待包含结果的新快照；失败时抛出，由调用方决定在哪里显示错误 */
  const apply = async (operations: ScoreboardOperation[], success: string) => {
    const { sentAt } = await request("scoreboard.apply", { operations });
    toast.success(success);
    await load({ after: sentAt });
  };

  const createObjective = async (operation: ScoreboardOperation) => {
    try {
      await apply([operation], "已创建计分项");
      if (operation.op === "objective.add") setSelectedId(operation.objective);
      setCreating(false);
    } catch (error) {
      toast.error("创建计分项失败", errorText(error));
    }
  };
  const submitScore = async (operation: ScoreboardOperation) => {
    try {
      await apply([operation], "已更新分数");
      setScoreDialog(null);
    } catch (error) {
      toast.error("修改分数失败", errorText(error));
    }
  };
  const removeObjective = (objective: ScoreboardObjectiveRow) => {
    void confirm({
      title: `删除计分项「${objectiveTitle(objective)}」？`,
      description: `将清除其中 ${objective.participants.length} 名参与者的全部分数，依赖该计分项的模块或命令方块可能受影响。`,
      danger: true,
      okText: "删除",
      acknowledge: "我了解分数删除后无法恢复",
      onConfirm: () => apply([{ op: "objective.remove", objective: objective.id }], "已删除计分项"),
    });
  };
  const resetParticipant = (objective: ScoreboardObjectiveRow, participant: ScoreboardParticipant) => {
    void confirm({
      title: `重置 ${participantName(participant)} 的分数？`,
      description: `将从计分项「${objectiveTitle(objective)}」中移除该参与者（当前 ${formatScore(participant.score)} 分）。`,
      danger: true,
      okText: "重置",
      onConfirm: () => apply([{ op: "score.reset", objective: objective.id, target: participant.name, participantId: participant.id }], "已重置分数"),
    });
  };

  const canEdit = editable && supported && Boolean(result?.available);
  const status = result && (!result.available || !result.fresh) ? result.note : undefined;

  return (
    <div className="page">
      <PageHeader
        title="计分板"
        meta={result?.updatedAt ? <span className="muted">同步于 {relativeTime(result.updatedAt, now)}</span> : undefined}
        actions={
          <>
            <Button icon="refresh" loading={loading} disabled={!supported} onClick={() => void load()}>刷新</Button>
            <Button icon="plus" variant="primary" disabled={!canEdit} onClick={() => setCreating(true)}>新建计分项</Button>
          </>
        }
      />
      {status && <Callout tone={result?.available ? "warning" : "info"} icon="info">{status}</Callout>}
      {result?.truncated && <Callout tone="warning">参与者过多，游戏内只同步了前一部分分数，统计与排行可能不完整。</Callout>}

      {result && !objectives.length ? (
        <Surface>
          <EmptyState
            icon="trophy"
            title={result.available ? "世界中还没有计分项" : "暂时读不到计分板"}
            description={result.available ? "新建一个计分项，或由模块、命令方块创建后会显示在这里" : result.note}
            action={result.available && canEdit ? <Button size="sm" icon="plus" onClick={() => setCreating(true)}>新建计分项</Button> : undefined}
          />
        </Surface>
      ) : (
        <div className="scoreboard-layout">
          <Surface flush className="scoreboard-objectives">
            <div className="list-toolbar">
              <SearchInput size="sm" value={objectiveKeyword} onChange={setObjectiveKeyword} placeholder="搜索计分项" />
            </div>
            <ul className="scoreboard-objective-list">
              {shownObjectives.map((objective) => {
                const slots = objectiveSlots(result, objective.id);
                return (
                  <li key={objective.id}>
                    <button type="button" className={cx("scoreboard-objective", selected?.id === objective.id && "active")} onClick={() => setSelectedId(objective.id)}>
                      <span className="scoreboard-objective-main">
                        <b className="truncate">{objectiveTitle(objective)}</b>
                        <span className="mono muted truncate">{objective.id}</span>
                      </span>
                      <span className="scoreboard-objective-meta">
                        {slots.length > 0 && <Badge tone="info" icon="eye" title={slots.join("、")}>显示中</Badge>}
                        <span className="mono muted">{objective.participants.length}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!shownObjectives.length && <li className="muted inline-empty">{result ? "没有匹配的计分项" : "正在读取…"}</li>}
            </ul>
          </Surface>

          {selected ? (
            <div className="scoreboard-detail">
              <Surface
                title={objectiveTitle(selected)}
                description={<span className="mono">{selected.id}</span>}
                extra={
                  <span className="scoreboard-detail-actions">
                    {objectiveSlots(result, selected.id).map((slot) => <Badge key={slot} tone="info" icon="eye">{slot}</Badge>)}
                    <Button size="sm" variant="danger-soft" icon="trash" disabled={!canEdit} onClick={() => removeObjective(selected)}>删除计分项</Button>
                  </span>
                }
              >
                <ObjectiveCharts objective={selected} />
              </Surface>

              <Surface flush>
                <div className="list-toolbar">
                  <SearchInput size="sm" className="toolbar-search" value={keyword} onChange={setKeyword} placeholder="搜索参与者" />
                  <Select size="sm" label="排序" width={140} value={sort} onChange={setSort} options={SCOREBOARD_SORTS.map((row) => ({ value: row.value, label: row.label }))} />
                  <span className="toolbar-spacer" />
                  <Button size="sm" icon="plus" disabled={!canEdit} onClick={() => setScoreDialog({ objective: selected, participant: null })}>添加参与者</Button>
                </div>
                {participants.length ? (
                  <ul className="scoreboard-participants">
                    {participants.slice(0, visible).map((participant) => {
                      const name = participantName(participant);
                      const tag = participantTag(participant);
                      const block = scoreboardTargetBlock(participant);
                      return (
                        <li key={participant.id} className="scoreboard-participant">
                          <Avatar name={name} hue={hashHue(name)} size={24} />
                          <span className="scoreboard-participant-main">
                            <span className="truncate" title={name}>{name}</span>
                            {block && <span className="activity-sub" title={block}>{block}</span>}
                          </span>
                          <Badge tone={tag.tone}>{tag.label}</Badge>
                          <b className={cx("mono scoreboard-score", participant.score < 0 && "tone-text-danger")}>{formatScore(participant.score)}</b>
                          <IconButton icon="pencil" label="修改分数" size="sm" disabled={!canEdit || Boolean(block)} onClick={() => setScoreDialog({ objective: selected, participant })} />
                          <IconButton icon="eraser" label="重置分数" size="sm" danger disabled={!canEdit || Boolean(block)} onClick={() => resetParticipant(selected, participant)} />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState compact icon="users" title={keyword ? "没有匹配的参与者" : "这个计分项还没有参与者"} />
                )}
                {participants.length > visible && (
                  <div className="activity-pager">
                    <span className="muted">已显示 {visible} / {participants.length} 名</span>
                    <span className="toolbar-spacer" />
                    <Button size="sm" variant="ghost" onClick={() => setVisible((count) => count + LIST_STEP)}>显示更多</Button>
                  </div>
                )}
              </Surface>
            </div>
          ) : (
            <Surface>
              <EmptyState icon="trophy" title={result ? "选择一个计分项" : "正在读取计分板…"} />
            </Surface>
          )}
        </div>
      )}

      <ObjectiveDialog open={creating} objectives={objectives} onClose={() => setCreating(false)} onSubmit={createObjective} />
      <ScoreDialog state={scoreDialog} onClose={() => setScoreDialog(null)} onSubmit={submitScore} />
    </div>
  );
}