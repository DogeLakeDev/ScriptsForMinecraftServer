/**
 * 「插入变量」菜单的纯数据层。
 *
 * - 不依赖 React：buildInsertMenu(ctx) → InsertMenu（sections + items）
 * - 与 ExprField 解耦：UI 层只负责渲染 / 回调插入，菜单结构集中在此。
 * - 序列化约定：每条 item 的 insert 字段就是「插入到文本框」的字面 token；
 *   与 expr.ts 的解析器一一对应（@out.<name> / @scene.<x> / @lastEmit / @lastCall）。
 */

import { valueAsString } from "../../graph/assert.ts";
import type { SceneSummary } from "../metaForm";

export type InsertMenuItem = {
  /** 插入到文本框的字面 token；与 expr.ts 解析器语义对齐 */
  insert: string;
  /** 菜单中显示的主文本（标签 / 名袋键 / 实例名） */
  label: string;
  /** 副文本：值的简短预览；超长会被截断 */
  preview?: string;
  /** 不可插入（场景中尚无记录 / 未 inspect）；仅作展示，UI 可据此禁用 */
  disabled?: boolean;
};

export type InsertMenuSection = {
  /** 段落标题（@out / @scene / @lastEmit / @lastCall） */
  title: string;
  items: InsertMenuItem[];
};

/** ExprField 侧已有的「上下文」形态；保持与 ExprFieldContext 一致但避免循环依赖 */
export type InsertMenuContext = {
  scene: SceneSummary | null;
  /** Call 节点 out 袋 */
  out?: Record<string, unknown>;
};

/** 截断预览，避免长 JSON 把菜单撑爆 */
const PREVIEW_MAX = 64;
function previewOf(v: unknown): string {
  const s = valueAsString(v);
  if (!s) return "（空）";
  return s.length > PREVIEW_MAX ? `${s.slice(0, PREVIEW_MAX - 1)}…` : s;
}

/** @out 段落：Call 节点具名返回值 */
function buildOutSection(out: Record<string, unknown> | undefined): InsertMenuSection {
  const items: InsertMenuItem[] = [];
  const keys = out ? Object.keys(out).sort() : [];
  for (const key of keys) {
    items.push({
      insert: `@out.${key}`,
      label: key,
      preview: previewOf(out![key]),
    });
  }
  return { title: "@out", items };
}

/** @scene 段落：场景中已存在的实例 */
function buildSceneSection(scene: SceneSummary | null): InsertMenuSection {
  const items: InsertMenuItem[] = [];
  if (!scene) return { title: "@scene", items };
  if (scene.world) {
    items.push({ insert: "@scene.world", label: "world", preview: `ref · id=${scene.world.id}` });
  }
  if (scene.scoreboard) {
    items.push({
      insert: "@scene.scoreboard",
      label: "scoreboard",
      preview: `ref · id=${scene.scoreboard.id}`,
    });
  }
  for (const d of scene.dimensions ?? []) {
    items.push({
      insert: `@scene.${d.dimensionId}`,
      label: d.dimensionId,
      preview: `ref · id=${d.id}`,
    });
  }
  for (const p of scene.players ?? []) {
    items.push({
      insert: `@scene.${p.name}`,
      label: p.name,
      preview: `ref · Player · id=${p.id}`,
    });
  }
  for (const e of scene.entities ?? []) {
    const id = e.typeId ?? e.id;
    items.push({
      insert: `@scene.${id}`,
      label: id,
      preview: `ref · Entity · id=${e.id}`,
    });
  }
  for (const i of scene.items ?? []) {
    const id = i.typeId ?? i.id;
    items.push({
      insert: `@scene.${id}`,
      label: id,
      preview: `ref · ItemStack · id=${i.id}`,
    });
  }
  for (const b of scene.blocks ?? []) {
    items.push({
      insert: `@scene.${b.id}`,
      label: b.id,
      preview: `ref · Block · id=${b.id}`,
    });
  }
  return { title: "@scene", items };
}

/** @lastEmit 段落：单条；无记录时禁用 */
function buildLastEmitSection(scene: SceneSummary | null): InsertMenuSection {
  const last = scene?.lastEmit ?? null;
  if (!last) {
    return {
      title: "@lastEmit",
      items: [
        { insert: "@lastEmit", label: "@lastEmit", preview: "（尚无 emit 记录）", disabled: true },
      ],
    };
  }
  return {
    title: "@lastEmit",
    items: [
      {
        insert: "@lastEmit",
        label: "@lastEmit",
        preview: `path=${last.path} · payload=${previewOf(last.payload)}`,
      },
    ],
  };
}

/** @lastCall 段落：单条；无记录时禁用 */
function buildLastCallSection(scene: SceneSummary | null): InsertMenuSection {
  const last = scene?.lastCall ?? null;
  if (!last) {
    return {
      title: "@lastCall",
      items: [
        { insert: "@lastCall", label: "@lastCall", preview: "（尚无 call 记录）", disabled: true },
      ],
    };
  }
  return {
    title: "@lastCall",
    items: [
      {
        insert: "@lastCall",
        label: "@lastCall",
        preview: `id=${last.id} · ${last.method}() · result=${previewOf(last.result)}`,
      },
    ],
  };
}

/** 顶层入口：按 scene / out 现状拼接四段；段为空时仍返回（UI 决定是否隐藏） */
export function buildInsertMenu(ctx: InsertMenuContext): InsertMenuSection[] {
  return [
    buildOutSection(ctx.out),
    buildSceneSection(ctx.scene),
    buildLastEmitSection(ctx.scene),
    buildLastCallSection(ctx.scene),
    // 「完整 @scene.<x>.<y>... 链式」「$id.prop via refs」不展开为菜单项——
    // 作者想插入链式路径时，输入 @out.foo.[datalist 给 props 一层前缀提示]，手动补二级。
  ];
}
