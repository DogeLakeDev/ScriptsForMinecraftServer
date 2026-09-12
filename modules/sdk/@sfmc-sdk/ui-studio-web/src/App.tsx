/**
 * App.tsx — UI Studio 三栏布局与预览会话管理。
 *
 * 左：工程/页面树；中：语义预览画布；右：属性查看（切片 1 只读）；底：诊断区。
 * 预览完全在浏览器内进行：action 只展示将调用的 service 与参数，不实际调用。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  UiActionDefinition,
  UiScreenDocument,
} from "../../src/contracts/ui-document.js";
import type { UiStudioProjectSnapshot } from "../../src/ui-studio/project.js";
import { fetchProject } from "./api";
import { asFixture, type Selection } from "./model";
import { initialSession, type PreviewSession } from "./scope";
import { ProjectTree } from "./components/ProjectTree";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Diagnostics } from "./components/Diagnostics";

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

export function App() {
  const [snapshot, setSnapshot] = useState<UiStudioProjectSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [sessions, setSessions] = useState<Record<string, PreviewSession>>({});
  const [actionPreview, setActionPreview] = useState<ActionPreview | null>(null);
  const [closedScreen, setClosedScreen] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchProject()
      .then((data) => {
        setSnapshot(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(reload, [reload]);

  const fixture = useMemo(() => asFixture(snapshot?.fixture), [snapshot]);
  // 树/画布/属性一律走可浏览视图：工程有诊断时仍可浏览定位。
  const screens = snapshot?.browse.screens ?? {};
  const screenIds = useMemo(
    () =>
      snapshot?.browse.feature?.screens
        .map((item) => item.id)
        .filter((id) => id in screens) ?? [],
    [snapshot, screens],
  );

  // 当前预览页面：导航栈顶；缺省为第一个页面。
  const currentEntry = navStack[navStack.length - 1] ?? null;
  const currentScreenId = currentEntry?.screenId ?? screenIds[0] ?? null;
  const currentScreen: UiScreenDocument | null =
    (currentScreenId ? screens[currentScreenId] : null) ?? null;

  // 数据就绪后默认选中第一个页面。
  useEffect(() => {
    if (!selection && currentScreenId) {
      setSelection({ screenId: currentScreenId, nodePath: "" });
    }
  }, [selection, currentScreenId]);

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

  /** 树中选择页面：重置导航栈并清空会话，回到初始预览。 */
  const selectScreen = useCallback(
    (screenId: string) => {
      const screen = screens[screenId];
      setNavStack([{ screenId }]);
      setClosedScreen(null);
      setSelection({ screenId, nodePath: "" });
      if (screen) {
        setSessions((prev) => ({ ...prev, [screenId]: initialSession(screen, fixture) }));
      }
    },
    [screens, fixture],
  );

  const selectNode = useCallback((screenId: string, nodePath: string) => {
    setSelection({ screenId, nodePath });
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
      setSelection({ screenId: target, nodePath: "" });
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

  if (error) {
    return (
      <div className="app-loading">
        <p>工程加载失败：{error}</p>
        <button className="btn" onClick={reload}>重试</button>
      </div>
    );
  }
  if (!snapshot) {
    return <div className="app-loading">正在加载 UI 工程…</div>;
  }

  // 会话在 selectScreen / navigateTo 时已按参数建好；这里只取或按默认值懒建。
  const session = currentScreen ? sessionFor(currentScreen) : null;

  return (
    <div className="studio">
      <header className="studio-header">
        <span className="studio-title">SFMC UI Studio</span>
        <span className="studio-project" title={snapshot.uiRoot}>
          {snapshot.browse.feature?.name ?? snapshot.browse.feature?.moduleId ?? "未命名工程"}
        </span>
        <span className="studio-spacer" />
        <button className="btn" onClick={reload} title="重新读取磁盘上的工程文件">
          重新加载
        </button>
      </header>
      <div className="studio-main">
        <aside className="panel panel-left">
          <ProjectTree
            snapshot={snapshot}
            selection={selection}
            onSelectScreen={selectScreen}
            onSelectNode={selectNode}
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
          <Inspector snapshot={snapshot} selection={selection} />
        </aside>
      </div>
      <footer className="panel panel-bottom">
        <Diagnostics
          snapshot={snapshot}
          onLocate={(target) => {
            // 定位诊断：画布切到目标页面（页面可浏览时）并选中节点。
            if (screens[target.screenId]) {
              setNavStack([{ screenId: target.screenId }]);
              setClosedScreen(null);
            }
            setSelection(target);
          }}
        />
      </footer>
      {actionPreview ? (
        <div className="modal-mask" onClick={() => setActionPreview(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>动作预览（不会实际调用）</h3>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
