/**
 * draft.ts — Studio 编辑器内的文件草稿与撤销重做模型。
 *
 * 项目化改造后的编辑语义：
 * - 编辑直接作用在内存文件表（files）上，统一以「整表 prev/next」入撤销栈，
 *   字段级编辑与文件级操作（新建/删除/重命名页面）共享同一撤销历史；
 * - 自动持久化：文件表变更后防抖写入 IndexedDB，无需手动保存；
 * - 未知字段随文档整体克隆保留。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 一步编辑：整表前后引用（撤销写回 prev，重做写回 next）。 */
interface DraftEdit {
  prev: Record<string, unknown>;
  next: Record<string, unknown>;
}

interface DraftState {
  files: Record<string, unknown>;
  /** 上次持久化到 IndexedDB 的文件表（脏判定基准）。 */
  persisted: Record<string, unknown>;
  undoStack: DraftEdit[];
  redoStack: DraftEdit[];
}

export interface FileDraftsApi {
  files: Record<string, unknown>;
  /** 有未持久化修改（自动保存进行中或待触发）。 */
  dirty: boolean;
  saving: boolean;
  /** 最近一次持久化完成时间（ms）。 */
  savedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  /** 字段级编辑：克隆目标文件 → mutate 原地修改 → 整表替换入栈。 */
  applyEdit(file: string, mutate: (doc: never) => boolean | void): void;
  /** 文件级操作：整体替换文件表（新建/删除/重命名页面等），作为一步撤销。 */
  replaceFiles(next: Record<string, unknown>): void;
  undo(): void;
  redo(): void;
  /** 立即持久化（Ctrl+S）；通常靠防抖自动触发。 */
  flush(): void;
}

/** 自动保存防抖间隔。 */
const AUTOSAVE_MS = 600;

export function useFileDrafts(
  initialFiles: Record<string, unknown>,
  persist: (files: Record<string, unknown>) => Promise<void>,
): FileDraftsApi {
  const [state, setState] = useState<DraftState>(() => ({
    files: initialFiles,
    persisted: initialFiles,
    undoStack: [],
    redoStack: [],
  }));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 持久化回调可能随渲染变化（捕获最新项目对象），用 ref 保持稳定。
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doPersist = useCallback(async (files: Record<string, unknown>) => {
    setSaving(true);
    try {
      await persistRef.current(files);
      setSavedAt(Date.now());
      setState((prev) =>
        // 仅当期间没有新编辑才推进基线，避免覆盖更新的草稿。
        prev.files === files ? { ...prev, persisted: files } : prev,
      );
    } catch (error) {
      console.error("[ui-studio] 自动保存失败：", error);
    } finally {
      setSaving(false);
    }
  }, []);

  // 文件表变更后防抖自动持久化。
  useEffect(() => {
    if (state.files === state.persisted) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const files = state.files;
    timerRef.current = setTimeout(() => void doPersist(files), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.files, state.persisted, doPersist]);

  const applyEdit = useCallback(
    (file: string, mutate: (doc: never) => boolean | void) => {
      setState((prev) => {
        if (!(file in prev.files)) return prev;
        const next_doc = structuredClone(prev.files[file]);
        const applied = mutate(next_doc as never);
        if (applied === false) return prev;
        const next = { ...prev.files, [file]: next_doc };
        return {
          ...prev,
          files: next,
          undoStack: [...prev.undoStack, { prev: prev.files, next }],
          redoStack: [],
        };
      });
    },
    [],
  );

  const replaceFiles = useCallback((next: Record<string, unknown>) => {
    setState((prev) => {
      if (next === prev.files) return prev;
      return {
        ...prev,
        files: next,
        undoStack: [...prev.undoStack, { prev: prev.files, next }],
        redoStack: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const edit = prev.undoStack[prev.undoStack.length - 1];
      if (!edit) return prev;
      return {
        ...prev,
        files: edit.prev,
        undoStack: prev.undoStack.slice(0, -1),
        redoStack: [...prev.redoStack, edit],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const edit = prev.redoStack[prev.redoStack.length - 1];
      if (!edit) return prev;
      return {
        ...prev,
        files: edit.next,
        redoStack: prev.redoStack.slice(0, -1),
        undoStack: [...prev.undoStack, edit],
      };
    });
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((prev) => {
      if (prev.files !== prev.persisted) void doPersist(prev.files);
      return prev;
    });
  }, [doPersist]);

  const dirty = useMemo(() => state.files !== state.persisted, [state.files, state.persisted]);

  return {
    files: state.files,
    dirty,
    saving,
    savedAt,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    applyEdit,
    replaceFiles,
    undo,
    redo,
    flush,
  };
}
