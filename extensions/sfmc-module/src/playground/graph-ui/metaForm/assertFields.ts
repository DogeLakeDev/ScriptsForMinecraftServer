/**
 * 断言节点字段映射：按 assertKind 取舍 StimulusNodeData 上的可选字段。
 * 渲染层（PropsPanelBody.AssertFields）只展示当前 kind 的字段，避免选 log 仍露 propName 等无关项。
 * 切换 kind 时残留值**不**清空——用户可能来回切；序列化时按 kind 裁切持久化由上游负责。
 */

import type { AssertKind } from "../../graph/assert";
import type { MetaProp } from "../metaForm";

export type AssertFieldDef = {
  /** StimulusNodeData 上对应的字段名 */
  name: string;
  /** 在断言求值中的角色（仅展示用） */
  role: "pattern" | "expected" | "meta";
};

const META: Omit<MetaProp, "name"> = { readonly: false };

/** log / logNot：pattern 是必填项，其余为筛选条件 */
const LOG_FIELDS: AssertFieldDef[] = [
  { name: "pattern", role: "pattern" },
  { name: "ignoreCase", role: "meta" },
  { name: "logRecentN", role: "meta" },
  { name: "logMinLevel", role: "meta" },
  { name: "logSource", role: "meta" },
];

/** lastEmit / lastCall：propName + expected + matchMode，与 pattern 二选一 */
const LAST_FIELDS: AssertFieldDef[] = [
  { name: "propName", role: "meta" },
  { name: "matchMode", role: "meta" },
  { name: "expected", role: "expected" },
  { name: "pattern", role: "pattern" },
  { name: "ignoreCase", role: "meta" },
];

/** sceneExists：按 targetKind / name / id 过滤场景行 */
const SCENE_EXISTS_FIELDS: AssertFieldDef[] = [
  { name: "targetKind", role: "meta" },
  { name: "targetName", role: "meta" },
  { name: "targetId", role: "meta" },
];

/** prop：必填 propName，expected + matchMode 配套；可选 ignoreCase */
const PROP_FIELDS: AssertFieldDef[] = [
  { name: "targetKind", role: "meta" },
  { name: "targetId", role: "meta" },
  { name: "propName", role: "meta" },
  { name: "matchMode", role: "meta" },
  { name: "expected", role: "expected" },
  { name: "ignoreCase", role: "meta" },
];

/** count：targetKind + name + countOp + countN */
const COUNT_FIELDS: AssertFieldDef[] = [
  { name: "targetKind", role: "meta" },
  { name: "targetName", role: "meta" },
  { name: "countOp", role: "meta" },
  { name: "countN", role: "meta" },
];

export const ASSERT_FIELDS_BY_KIND: Record<AssertKind, AssertFieldDef[]> = {
  log: LOG_FIELDS,
  logNot: LOG_FIELDS,
  sceneExists: SCENE_EXISTS_FIELDS,
  prop: PROP_FIELDS,
  count: COUNT_FIELDS,
  lastEmit: LAST_FIELDS,
  lastCall: LAST_FIELDS,
};

/** 渲染在字段顶部的一行中文 hint（解释当前 kind 测什么） */
export const ASSERT_KIND_HINT: Record<AssertKind, string> = {
  log: "最近 N 条日志（含 / 不含大小写、级别、来源）匹配 pattern",
  logNot: "最近 N 条日志均不匹配 pattern（其余筛选项同 log）",
  sceneExists: "按 kind / name / id 过滤场景，至少有一行命中即通过",
  prop: "取目标 inspect 快照上的 propName，与 expected 字符串按 matchMode 比较",
  count: "按 kind + 可选 name 数场景行，与 countOp / countN 比较",
  lastEmit: "匹配上次 emit 的 path / payload / result 文本或字段值",
  lastCall: "匹配上次 call 的 id.method / result，或指定字段值",
};

/** 把字段定义转成 MetaProp 列表，给 MetaPropForm 复用底层渲染 */
export function assertFieldsToMetaProps(fields: AssertFieldDef[]): MetaProp[] {
  return fields.map((f) => ({ name: f.name, ...META }));
}
