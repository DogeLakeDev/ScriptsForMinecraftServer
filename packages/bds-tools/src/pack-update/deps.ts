/**
 * pack-update 依赖注入契约（CLI 注入 i18n/theme/log；库测试可传英文回退）
 */

export type PackUpdateDeps = {
  rootDir: string;
  resolveBdsContext: () => { bdsRoot: string; levelName: string };
  log: (text: string, level?: "info" | "warn" | "error" | "success") => void;
  askConfirm: (message: string) => Promise<boolean>;
  /** i18n：CLI 传 t()；测试可传 key 或英文回退 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 可选着色；省略时用 identity */
  paint: {
    green: (s: string) => string;
    yellow: (s: string) => string;
    red: (s: string) => string;
    dim: (s: string) => string;
    cyan: (s: string) => string;
    bold: (s: string) => string;
  };
};

const id = (s: string): string => s;

/** 无 ANSI 的 identity paint（测试 / 非 TTY 回退） */
export function identityPaint(): PackUpdateDeps["paint"] {
  return { green: id, yellow: id, red: id, dim: id, cyan: id, bold: id };
}

/** 最小测试依赖：仅 rootDir，其余 noop / identity */
export function createTestPackUpdateDeps(rootDir: string): PackUpdateDeps {
  return {
    rootDir,
    resolveBdsContext: () => ({ bdsRoot: "", levelName: "" }),
    log: () => {},
    askConfirm: async () => true,
    t: (key) => key,
    paint: identityPaint(),
  };
}
