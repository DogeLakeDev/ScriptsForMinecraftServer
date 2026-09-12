/**
 * 把 disabledWhen 接到 CustomForm 的 ObservableBoolean。
 * 静态 boolean 只在首屏求值一次，开关锁定后其它输入不会跟着禁用。
 */

export type BooleanObservable = {
  getData(): boolean;
  setData(value: boolean): void;
  subscribe(callback: (value: boolean) => void): (value: boolean) => void;
};

export type DisabledWhenDeps = {
  derivedDefs: Record<string, unknown>;
  getStateBoolean(name: string): BooleanObservable | undefined;
  subscribeState(name: string, callback: () => void): void;
  evaluate(): boolean;
  createDerived(initial: boolean): BooleanObservable;
  existingDerived?: BooleanObservable | undefined;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStateNames(
  expr: unknown,
  derivedDefs: Record<string, unknown>,
  seen = new Set<string>(),
): string[] {
  if (!isObject(expr)) return [];
  if (typeof expr.ref === "string") {
    if (expr.ref.startsWith("state.")) return [expr.ref.slice("state.".length)];
    if (expr.ref.startsWith("derived.")) {
      const name = expr.ref.slice("derived.".length);
      if (seen.has(name)) return [];
      seen.add(name);
      return collectStateNames(derivedDefs[name], derivedDefs, seen);
    }
    return [];
  }
  if (!Array.isArray(expr.args)) return [];
  return expr.args.flatMap((item) => collectStateNames(item, derivedDefs, seen));
}

function simpleStateBooleanRef(expr: unknown): string | undefined {
  if (!isObject(expr)) return undefined;
  if (typeof expr.ref !== "string" || !expr.ref.startsWith("state.")) {
    return undefined;
  }
  if ("op" in expr || "args" in expr || "value" in expr) return undefined;
  return expr.ref.slice("state.".length);
}

/** 解析 disabledWhen：能复用 state 布尔就复用，否则派生一个并订阅源变化。 */
export function resolveDisabledControl(
  disabledWhen: unknown,
  deps: DisabledWhenDeps,
): BooleanObservable | undefined {
  if (disabledWhen === undefined) return undefined;

  const direct = simpleStateBooleanRef(disabledWhen);
  if (direct) {
    const control = deps.getStateBoolean(direct);
    if (control) return control;
  }

  if (deps.existingDerived) {
    deps.existingDerived.setData(deps.evaluate());
    return deps.existingDerived;
  }

  const derived = deps.createDerived(deps.evaluate());
  for (const name of new Set(collectStateNames(disabledWhen, deps.derivedDefs))) {
    deps.subscribeState(name, () => {
      derived.setData(deps.evaluate());
    });
  }
  return derived;
}
