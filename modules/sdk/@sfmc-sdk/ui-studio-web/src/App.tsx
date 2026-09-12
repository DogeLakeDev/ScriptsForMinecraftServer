/**
 * App.tsx — UI Studio 项目编辑器：三栏布局与预览会话管理。
 *
 * 左：工程/页面树（含文件操作）；中：语义预览画布；右：属性面板；底：诊断区。
 * 数据模型：项目文件表存于 IndexedDB，编辑在内存草稿上进行并自动持久化；
 * 画布/树/诊断由文件表实时派生（deriveView，与服务端同一套校验器）。
 * 预览完全在浏览器内进行：action 只展示将调用的 service 与参数，不实际调用。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowLeft,
  Download,
  FilePlus2,
  FileUp,
  FolderOpen,
  Redo2,
  Undo2,
} from "lucide-react";
import type {
  UiActionDefinition,
  UiScreenDocument,
} from "../../src/contracts/ui-document.js";
import { asFixture, type Selection } from "./model";
import { deriveView } from "./derived";
import { useFileDrafts } from "./draft";
import { initialSession, type PreviewSession } from "./scope";
import { getProject, putProject } from "./store/db";
import {
  addScreen,
  duplicateScreen,
  extractServicesFromManifest,
  FIXTURE_FILE,
  removeScreen,
  renameScreenFile,
  type StudioProject,
} from "./store/project";
import { downloadBlob, exportProjectZip } from "./zip";
import { ProjectTree } from "./components/ProjectTree";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Diagnostics } from "./components/Diagnostics";
import { HeaderMenu } from "./components/HeaderMenu";

/** 预览导航栈条目：一次跳转产生的页面与参数。 */
interface NavEntry {
  screenId: string;
  params?: Record<string, unknown>;
}

/** action 触发时的预览信息（只展示，不调用）。 */
export interface ActionPreview {
  screenId: string;
  actionId: string;
  action: UiActionDefinition;
  input: unknown;
}

interface AppProps {
  projectId: string;
  onExit(): void;
}

export function App({ projectId, onExit }: AppProps) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 装载项目（一次性）。
  useEffect(() => {
    getProject(projectId)
      .then((found) => {
        if (found) setProject(found);
        else setNotFound(true);
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : String(err)),
      );
  }, [projectId]);

  if (notFound) {
    return (
      <div className="app-loading">
        <p>项目不存在或已被删除。</p>
        <button className="btn" onClick={onExit}>返回项目列表</button>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="app-loading">
        <p>项目读取失败：{loadError}</p>
        <button className="btn" onClick={onExit}>返回项目列表</button>
      </div>
    );
  }
  if (!project) {
    return <div className="app-loading">正在加载项目…</div>;
  }
  // 关键：装载完成后再挂载编辑器，草稿直接以真实文件表初始化，
  // 杜绝「空文件表初始化草稿 → 误持久化覆盖项目数据」的窗口。
  return <ProjectEditor key={project.id} initialProject={project} onExit={onExit} />;
}

/** 项目编辑器本体：仅在项目装载完成后挂载。 */
function ProjectEditor({
  initialProject,
  onExit,
}: {
  initialProject: StudioProject;
  onExit(): void;
}) {
  const [project, setProject] = useState(initialProject);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [sessions, setSessions] = useState<Record<string, PreviewSession>>({});
  const [actionPreview, setActionPreview] = useState<ActionPreview | null>(null);
  const [closedScreen, setClosedScreen] = useState<string | null>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  // 持久化回调：以最新项目对象为基准写回 IndexedDB。
  const projectRef = useRef<StudioProject>(initialProject);
  projectRef.current = project;
  const persist = useCallback(async (files: Record<string, unknown>) => {
    const current = projectRef.current;
    const next = { ...current, files, updatedAt: Date.now() };
    projectRef.current = next;
    setProject(next);
    await putProject(next);
  }, []);

  const {
    files,
    dirty,
    saving,
    savedAt,
    canUndo,
    canRedo,
    applyEdit,
    replaceFiles,
    undo,
    redo,
    flush,
  } = useFileDrafts(project.files, persist);

  // 工程视图由文件表实时派生：编辑即刻反映到画布与诊断。
  const view = useMemo(() => deriveView(files, project.services), [project, files]);

  const fixture = useMemo(() => asFixture(files[FIXTURE_FILE]), [files]);

  // 树/画布/属性一律走可浏览视图：工程有诊断时仍可浏览定位。
  const screens = view.browse.screens;
  const screenIds = useMemo(
    () =>
      view.browse.feature?.screens
        .map((item) => item.id)
        .filter((id) => id in screens) ?? [],
    [view, screens],
  );

  // 当前预览页面：导航栈顶；缺省为第一个页面。
  const currentEntry = navStack[navStack.length - 1] ?? null;
  const currentScreenId = currentEntry?.screenId ?? screenIds[0] ?? null;
  const currentScreen: UiScreenDocument | null =
    (currentScreenId ? screens[currentScreenId] : null) ?? null;

  // 数据就绪后默认选中第一个页面。
  useEffect(() => {
    if (!selection && currentScreenId) {
      setSelection({ kind: "screen", screenId: currentScreenId, nodePath: "" });
    }
  }, [selection, currentScreenId]);

  // 当前页面被删除/失效时收回导航栈。
  useEffect(() => {
    if (currentEntry && !(currentEntry.screenId in screens)) {
      setNavStack([]);
      setSelection((prev) =>
        prev?.kind === "screen" && !(prev.screenId in screens) ? null : prev,
      );
    }
  }, [currentEntry, screens]);

  /** 取页面会话；不存在时按默认值 + fixture 初始化。 */
  const sessionFor = useCallback(
    (screen: UiScreenDocument, overrideParams?: Record<string, unknown>): PreviewSession => {
      const existing = sessions[screen.id];
      if (existing && !overrideParams) return existing;
      const created = initialSession(screen, fixture, overrideParams);
      setSessions((prev) => ({ ...prev, [screen.id]: created }));
      return created;
    },
    [sessions, fixture],
  );

  const updateState = useCallback(
    (screenId: string, key: string, value: unknown) => {
      setSessions((prev) => {
        const session = prev[screenId];
        if (!session) return prev;
        return {
          ...prev,
          [screenId]: { ...session, state: { ...session.state, [key]: value } },
        };
      });
    },
    [],
  );

  /** 统一选择入口（树/诊断定位）。 */
  const handleSelect = useCallback(
    (next: Selection) => {
      setSelection(next);
      if (next.kind === "screen") {
        // 切换页面：重置导航栈并清空会话，回到初始预览。
        setNavStack([{ screenId: next.screenId }]);
        setClosedScreen(null);
        const screen = screens[next.screenId];
        if (screen) {
          setSessions((prev) => ({
            ...prev,
            [next.screenId]: initialSession(screen, fixture),
          }));
        }
      }
    },
    [screens, fixture],
  );

  const selectNode = useCallback((screenId: string, nodePath: string) => {
    setSelection({ kind: "screen", screenId, nodePath });
  }, []);

  /** 画布内触发 navigate/replace：解析后的参数开启目标页面新会话。 */
  const navigateTo = useCallback(
    (target: string, params: Record<string, unknown> | undefined, replace: boolean) => {
      const screen = screens[target];
      if (!screen) return;
      setClosedScreen(null);
      setSessions((prev) => ({
        ...prev,
        [target]: initialSession(screen, fixture, params),
      }));
      setNavStack((prev) =>
        replace ? [...prev.slice(0, -1), { screenId: target, params }] : [...prev, { screenId: target, params }],
      );
      setSelection({ kind: "screen", screenId: target, nodePath: "" });
    },
    [screens, fixture],
  );

  const goBack = useCallback(() => {
    setNavStack((prev) => {
      if (prev.length <= 1) {
        // 栈底再 back 等价于关闭。
        const top = prev[0];
        if (top) setClosedScreen(top.screenId);
        return prev;
      }
      return prev.slice(0, -1);
    });
  }, []);

  // -------------------------------------------------------------------------
  // 文件操作（自动同步 feature.screens 引用；均为一步撤销）
  // -------------------------------------------------------------------------

  const handleAddScreen = useCallback(() => {
    const id = window.prompt("新页面 id（字母/数字/._-）：", "page");
    if (id === null) return;
    const trimmed = id.trim();
    if (!/^[a-z0-9_.-]+$/i.test(trimmed)) {
      window.alert("页面 id 只能包含字母、数字、点、下划线与连字符。");
      return;
    }
    const result = addScreen(files, trimmed);
    replaceFiles(result.files);
    setSelection({ kind: "screen", screenId: result.id, nodePath: "" });
    setNavStack([{ screenId: result.id }]);
  }, [files, replaceFiles]);

  const handleRenameScreen = useCallback(
    (file: string) => {
      const next = window.prompt("新的文件路径（相对工程根）：", file);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === file) return;
      if (!trimmed.endsWith(".json")) {
        window.alert("文件路径必须以 .json 结尾。");
        return;
      }
      const result = renameScreenFile(files, file, trimmed);
      if (!result) {
        window.alert(`目标路径已存在或源文件缺失：${trimmed}`);
        return;
      }
      replaceFiles(result);
    },
    [files, replaceFiles],
  );

  const handleDuplicateScreen = useCallback(
    (file: string) => {
      const result = duplicateScreen(files, file);
      if (!result) return;
      replaceFiles(result.files);
      setSelection({ kind: "screen", screenId: result.id, nodePath: "" });
      setNavStack([{ screenId: result.id }]);
    },
    [files, replaceFiles],
  );

  const handleRemoveScreen = useCallback(
    (file: string) => {
      if (!window.confirm(`确定删除页面文件 ${file}？（可用撤销恢复）`)) return;
      replaceFiles(removeScreen(files, file));
    },
    [files, replaceFiles],
  );

  const handleRemoveFile = useCallback(
    (file: string) => {
      if (!window.confirm(`确定删除文件 ${file}？（可用撤销恢复）`)) return;
      const next = { ...files };
      delete next[file];
      replaceFiles(next);
      setSelection((prev) => (prev?.kind === "file" && prev.file === file ? null : prev));
    },
    [files, replaceFiles],
  );

  /** 整文件替换（其他文件的 JSON 编辑）。 */
  const handleReplaceFile = useCallback(
    (file: string, doc: unknown) => {
      replaceFiles({ ...files, [file]: doc });
    },
    [files, replaceFiles],
  );

  // -------------------------------------------------------------------------
  // 导入 manifest / 导出 zip
  // -------------------------------------------------------------------------

  const importManifest = useCallback(async (file: File) => {
    try {
      const doc = JSON.parse(await file.text()) as unknown;
      const services = extractServicesFromManifest(doc);
      const current = projectRef.current;
      if (!current) return;
      const nextProject = { ...current, services, updatedAt: Date.now() };
      projectRef.current = nextProject;
      setProject(nextProject);
      await putProject(nextProject);
    } catch (err) {
      window.alert(`manifest 解析失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const exportZip = useCallback(() => {
    const current = projectRef.current;
    if (!current) return;
    // 导出以当前草稿为准（含未落盘的编辑）。
    downloadBlob(
      exportProjectZip({ ...current, files }),
      `${current.name}.zip`,
    );
  }, [files]);

  // 快捷键：Ctrl+S 立即落盘；Ctrl+Z 撤销；Ctrl+Shift+Z / Ctrl+Y 重做。
  // 输入控件聚焦时不拦截撤销键，避免打断文本编辑。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        flush();
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush, undo, redo]);

  // -------------------------------------------------------------------------

  // 会话在 handleSelect / navigateTo 时已按参数建好；这里只取或按默认值懒建。
  const session = currentScreen ? sessionFor(currentScreen) : null;
  const saveStatus = saving
    ? "保存中…"
    : dirty
      ? "待保存…"
      : savedAt
        ? `已保存 ${new Date(savedAt).toLocaleTimeString()}`
        : "";

  return (
    <div className="studio">
      <header className="studio-header">
        <button className="btn btn-icon" onClick={onExit} title="返回项目列表">
          <ArrowLeft size={15} />
        </button>
        <span className="studio-project" title={project.id}>
          {project.name}
        </span>
        <span className="studio-save-status">{saveStatus}</span>
        <span className="studio-spacer" />
        {/* 顶栏菜单：文件 / 编辑（撤销重做同时保留图标按钮，便于观察可用状态） */}
        <HeaderMenu
          label="文件"
          entries={[
            { icon: FilePlus2, label: "新建页面", onClick: handleAddScreen },
            "separator",
            {
              icon: FileUp,
              label: `导入 manifest.json（当前 ${project.services.length} 个 service）`,
              onClick: () => manifestInputRef.current?.click(),
            },
            { icon: Download, label: "导出 zip", onClick: exportZip },
            "separator",
            { icon: FolderOpen, label: "返回项目列表", onClick: onExit },
          ]}
        />
        <HeaderMenu
          label="编辑"
          entries={[
            { icon: Undo2, label: "撤销", shortcut: "Ctrl+Z", disabled: !canUndo, onClick: undo },
            {
              icon: Redo2,
              label: "重做",
              shortcut: "Ctrl+Shift+Z",
              disabled: !canRedo,
              onClick: redo,
            },
          ]}
        />
        <button className="btn btn-icon" onClick={undo} disabled={!canUndo} title="撤销（Ctrl+Z）">
          <Undo2 size={15} />
        </button>
        <button
          className="btn btn-icon"
          onClick={redo}
          disabled={!canRedo}
          title="重做（Ctrl+Shift+Z）"
        >
          <Redo2 size={15} />
        </button>
        <input
          ref={manifestInputRef}
          type="file"
          accept=".json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importManifest(file);
            event.target.value = "";
          }}
        />
      </header>
      <div className="studio-main">
        <aside className="panel panel-left">
          <ProjectTree
            view={view}
            selection={selection}
            onSelect={handleSelect}
            onAddScreen={handleAddScreen}
            onRenameScreen={handleRenameScreen}
            onDuplicateScreen={handleDuplicateScreen}
            onRemoveScreen={handleRemoveScreen}
            onRemoveFile={handleRemoveFile}
          />
        </aside>
        <main className="panel panel-canvas">
          {currentScreen && session ? (
            <Canvas
              screen={currentScreen}
              fixture={fixture}
              session={session}
              selection={selection}
              closed={closedScreen === currentScreen.id}
              onSelectNode={(nodePath) => selectNode(currentScreen.id, nodePath)}
              onUpdateState={(key, value) => updateState(currentScreen.id, key, value)}
              onNavigate={navigateTo}
              onBack={goBack}
              onClose={() => setClosedScreen(currentScreen.id)}
              onAction={(preview) => setActionPreview(preview)}
              onReopen={() => setClosedScreen(null)}
            />
          ) : (
            <div className="canvas-empty">工程暂无可预览页面</div>
          )}
        </main>
        <aside className="panel panel-right">
          <Inspector
            view={view}
            selection={selection}
            onEdit={applyEdit}
            onReplaceFile={handleReplaceFile}
          />
        </aside>
      </div>
      <footer className="panel panel-bottom">
        <Diagnostics
          view={view}
          onLocate={(target) => {
            // 定位诊断：画布切到目标页面（页面可浏览时）并选中节点。
            if (target.kind === "screen" && screens[target.screenId]) {
              setNavStack([{ screenId: target.screenId }]);
              setClosedScreen(null);
            }
            setSelection(target);
          }}
        />
      </footer>
      {/* 动作预览弹层：Headless UI Dialog 提供焦点陷阱、ESC 关闭与遮罩点击关闭。 */}
      {actionPreview ? (
        <Dialog open={true} onClose={() => setActionPreview(null)} className="modal-mask">
          <DialogPanel className="modal">
            <DialogTitle as="h3">动作预览（不会实际调用）</DialogTitle>
            <dl>
              <dt>动作</dt>
              <dd>{actionPreview.actionId}</dd>
              <dt>service</dt>
              <dd>
                <code>{actionPreview.action.call.service}</code>
              </dd>
              <dt>解析后的 input</dt>
              <dd>
                <pre>{JSON.stringify(actionPreview.input, null, 2) || "（无）"}</pre>
              </dd>
              {actionPreview.action.confirm ? (
                <>
                  <dt>确认步骤</dt>
                  <dd>{actionPreview.action.confirm.title}</dd>
                </>
              ) : null}
              <dt>效果</dt>
              <dd>
                <pre>
                  {JSON.stringify(
                    {
                      onSuccess: actionPreview.action.onSuccess ?? [],
                      onError: actionPreview.action.onError ?? [],
                    },
                    null,
                    2,
                  )}
                </pre>
              </dd>
            </dl>
            <button className="btn" onClick={() => setActionPreview(null)}>关闭</button>
          </DialogPanel>
        </Dialog>
      ) : null}
    </div>
  );
}
