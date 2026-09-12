/**
 * store/project.ts — Studio 项目模型与文件操作。
 *
 * 项目 = 一组 JSON 文件（feature.ui.json + screens/*.ui.json + 可选 fixture）
 * + service 清单（由导入的 manifest.json 提取）。
 *
 * 文件操作（新建/重命名/删除/复制页面）会同步维护 feature.screens 引用，
 * 且只触碰已知字段，feature 文档中的未知字段原样保留。
 */

/** 预览 fixture 在项目内的固定路径。 */
export const FIXTURE_FILE = ".ui-studio/preview.fixture.json";

/** 场景 fixture 目录：.ui-studio/fixtures/<name>.json。 */
export const FIXTURE_DIR = ".ui-studio/fixtures";

export interface StudioProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** 文件表：键为相对路径（feature.ui.json / screens/x.ui.json / fixture）。 */
  files: Record<string, unknown>;
  /** manifest.services.provides 提取出的 service 名称。 */
  services: string[];
}

/** 生成项目 id（时间戳 + 随机，可读且基本不撞）。 */
export function newProjectId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 空白页面文档模板。 */
export function newScreenDocument(id: string, name?: string): unknown {
  return {
    formatVersion: 1,
    id,
    ...(name ? { name } : {}),
    presentation: "auto",
    title: name ?? id,
    body: [],
  };
}

/** 新建项目的初始文件表：feature + 一个示例页面 + 预览 fixture。 */
function initialFiles(): Record<string, unknown> {
  return {
    "feature.ui.json": {
      formatVersion: 1,
      moduleId: "my-module",
      name: "我的 UI 工程",
      entries: [],
      screens: [{ id: "home", file: "screens/home.ui.json" }],
    },
    "screens/home.ui.json": {
      formatVersion: 1,
      id: "home",
      name: "首页",
      presentation: "auto",
      title: "首页",
      body: [
        { type: "header", id: "title", text: "你好，{{player.name}}", tone: "primary" },
        { type: "text", id: "tip", text: "从左侧组件树开始搭建你的界面。" },
      ],
    },
    [FIXTURE_FILE]: {
      player: { id: "preview-player-0000", name: "预览玩家", level: 12 },
    },
  };
}

/** 创建新项目（尚未持久化，由调用方 putProject）。 */
export function createProject(name: string): StudioProject {
  const now = Date.now();
  return {
    id: newProjectId(),
    name,
    createdAt: now,
    updatedAt: now,
    files: initialFiles(),
    services: [],
  };
}

// ---------------------------------------------------------------------------
// 文件操作：全部返回新的 files 表（不可变），并同步 feature.screens 引用
// ---------------------------------------------------------------------------

/** 读取 feature 文档（宽松）。 */
function featureDoc(files: Record<string, unknown>): Record<string, unknown> | null {
  const doc = files["feature.ui.json"];
  return typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>) : null;
}

/** 用新的 screens 引用数组替换 feature.screens（保留其他字段）。 */
function withScreenRefs(
  files: Record<string, unknown>,
  refs: Array<{ id: string; file: string }>,
): Record<string, unknown> {
  const feature = featureDoc(files);
  if (!feature) return files;
  return { ...files, "feature.ui.json": { ...feature, screens: refs } };
}

/** 当前 feature 声明的页面引用（宽松解析，非法条目跳过）。 */
export function screenRefs(
  files: Record<string, unknown>,
): Array<{ id: string; file: string }> {
  const feature = featureDoc(files);
  const screens = feature?.screens;
  if (!Array.isArray(screens)) return [];
  return screens
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as { id?: unknown; file?: unknown })
        : null,
    )
    .filter(
      (item): item is { id: string; file: string } =>
        typeof item?.id === "string" && typeof item.file === "string",
    );
}

/** 为页面文件生成不冲突的路径：screens/<id>.ui.json，撞名加 -2/-3…。 */
function uniqueScreenPath(files: Record<string, unknown>, id: string): string {
  const base = `screens/${id}.ui.json`;
  if (!(base in files)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `screens/${id}-${i}.ui.json`;
    if (!(candidate in files)) return candidate;
  }
}

/** 生成不冲突的页面 id。 */
function uniqueScreenId(files: Record<string, unknown>, wanted: string): string {
  const taken = new Set(screenRefs(files).map((ref) => ref.id));
  if (!taken.has(wanted)) return wanted;
  for (let i = 2; ; i += 1) {
    if (!taken.has(`${wanted}-${i}`)) return `${wanted}-${i}`;
  }
}

/** 新建页面：生成文件并登记到 feature.screens。 */
export function addScreen(
  files: Record<string, unknown>,
  wantedId: string,
): { files: Record<string, unknown>; id: string; file: string } {
  const id = uniqueScreenId(files, wantedId);
  const file = uniqueScreenPath(files, id);
  const refs = [...screenRefs(files), { id, file }];
  return {
    files: { ...withScreenRefs(files, refs), [file]: newScreenDocument(id) },
    id,
    file,
  };
}

/** 删除页面文件并摘除 feature 引用。 */
export function removeScreen(
  files: Record<string, unknown>,
  file: string,
): Record<string, unknown> {
  const next = { ...files };
  delete next[file];
  return withScreenRefs(
    next,
    screenRefs(next).filter((ref) => ref.file !== file),
  );
}

/**
 * 重命名/移动页面文件（改路径不改 id），同步 feature 引用。
 * 目标路径已存在时返回 null（调用方提示）。
 */
export function renameScreenFile(
  files: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> | null {
  if (from === to) return files;
  if (to in files) return null;
  const doc = files[from];
  if (doc === undefined) return null;
  const next = { ...files };
  delete next[from];
  next[to] = doc;
  return withScreenRefs(
    next,
    screenRefs(next).map((ref) => (ref.file === from ? { ...ref, file: to } : ref)),
  );
}

/** 复制页面：新 id + 新文件，内容深拷贝（id 字段同步为新 id）。 */
export function duplicateScreen(
  files: Record<string, unknown>,
  fromFile: string,
): { files: Record<string, unknown>; id: string; file: string } | null {
  const doc = files[fromFile];
  if (typeof doc !== "object" || doc === null) return null;
  const source = doc as Record<string, unknown>;
  const baseId = typeof source.id === "string" ? source.id : "page";
  const id = uniqueScreenId(files, `${baseId}-copy`);
  const file = uniqueScreenPath(files, id);
  const copy = structuredClone(source);
  copy.id = id;
  if (typeof copy.name === "string") copy.name = `${copy.name} 副本`;
  const refs = [...screenRefs(files), { id, file }];
  return { files: { ...withScreenRefs(files, refs), [file]: copy }, id, file };
}

/** 列出场景 fixture 文件（.ui-studio/fixtures/*.json，按路径排序）。 */
export function fixtureScenarios(files: Record<string, unknown>): string[] {
  const prefix = `${FIXTURE_DIR}/`;
  return Object.keys(files)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort();
}

/**
 * 新建场景：以基础 fixture 为模板复制到 .ui-studio/fixtures/<name>.json；
 * 非法字符替换为 -，撞名自动加 -2/-3…。名称为空时返回 null。
 */
export function addFixtureScenario(
  files: Record<string, unknown>,
  wantedName: string,
): { files: Record<string, unknown>; file: string } | null {
  // 允许 Unicode 字母/数字（中文场景名可用），其余字符折叠为 -。
  const safe = wantedName
    .trim()
    .replace(/[^\p{L}\p{N}_.-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!safe) return null;
  let file = `${FIXTURE_DIR}/${safe}.json`;
  for (let n = 2; file in files; n += 1) {
    file = `${FIXTURE_DIR}/${safe}-${n}.json`;
  }
  const base = files[FIXTURE_FILE];
  const doc = typeof base === "object" && base !== null ? structuredClone(base) : {};
  return { files: { ...files, [file]: doc }, file };
}

/**
 * 重命名/移动普通文件（不触碰 feature 引用；页面文件请用 renameScreenFile）。
 * 目标路径已存在或源缺失时返回 null。
 */
export function renameFile(
  files: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> | null {
  if (from === to) return files;
  if (to in files) return null;
  const doc = files[from];
  if (doc === undefined) return null;
  const next = { ...files };
  delete next[from];
  next[to] = doc;
  return next;
}

/** 从 manifest 文档提取 services.provides 名称。 */
export function extractServicesFromManifest(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null) return [];
  const provides = (manifest as { services?: { provides?: unknown } }).services?.provides;
  if (!Array.isArray(provides)) return [];
  return provides
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as { name?: unknown }).name
        : null,
    )
    .filter((name): name is string => typeof name === "string");
}
