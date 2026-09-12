/**
 * scope.ts — 预览作用域组装。
 *
 * 按设计文档的数据作用域表构建 player / params / data / state / derived，
 * 优先级：页面默认值 < fixture < 预览会话（用户在画布中的输入与跳转参数）。
 */

import type { UiScreenDocument } from "../../src/contracts/ui-document.js";
import {
  evaluateExpression,
  type UiEvaluateScope,
} from "../../src/ui-studio/shared/evaluate.js";
import { DEFAULT_PLAYER, type PreviewFixture } from "./model";

/** 预览会话：画布输入产生的 state 与跳转带来的 params。 */
export interface PreviewSession {
  params: Record<string, unknown>;
  state: Record<string, unknown>;
}

export function initialSession(
  screen: UiScreenDocument,
  fixture: PreviewFixture,
  overrideParams?: Record<string, unknown>,
): PreviewSession {
  const screenFixture = fixture.screens?.[screen.id] ?? {};
  return {
    params: {
      ...paramDefaults(screen),
      ...fixture.params,
      ...screenFixture.params,
      ...overrideParams,
    },
    state: {
      ...stateDefaults(screen),
      ...fixture.state,
      ...screenFixture.state,
    },
  };
}

function paramDefaults(screen: UiScreenDocument): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(screen.params ?? {})
      .filter(([, definition]) => definition.default !== undefined)
      .map(([key, definition]) => [key, definition.default]),
  );
}

function stateDefaults(screen: UiScreenDocument): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(screen.state ?? {}).map(([key, definition]) => [
      key,
      definition.default ?? defaultForType(definition.type),
    ]),
  );
}

function defaultForType(type: "string" | "number" | "boolean"): unknown {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

/** 组装求值作用域；derived 按声明顺序求值，允许引用先声明的 derived。 */
export function buildScope(
  screen: UiScreenDocument,
  fixture: PreviewFixture,
  session: PreviewSession,
): UiEvaluateScope {
  const screenFixture = fixture.screens?.[screen.id] ?? {};
  const scope: UiEvaluateScope = {
    player: fixture.player ?? DEFAULT_PLAYER,
    params: session.params,
    data: { ...fixture.data, ...screenFixture.data },
    state: session.state,
    derived: {},
  };
  const derived = scope.derived as Record<string, unknown>;
  for (const [key, expression] of Object.entries(screen.derived ?? {})) {
    derived[key] = evaluateExpression(expression, scope);
  }
  return scope;
}
