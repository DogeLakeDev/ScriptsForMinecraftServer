/**
 * store/db.ts — Studio 项目的 IndexedDB 持久化封装。
 *
 * Studio 是纯浏览器应用：所有工程数据存放在浏览器本地 IndexedDB，
 * 刷新/重开不丢失；导出通过 zip 下载，导入通过 zip/manifest 上传。
 * 不依赖任何服务端 API。
 */

import type { StudioProject } from "./project";

const DB_NAME = "sfmc-ui-studio";
const DB_VERSION = 1;
const STORE = "projects";

/** 打开数据库（按需创建 object store）。 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });
}

/** 包装单条事务为 Promise。 */
function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作失败"));
  });
}

/** 项目列表（按更新时间倒序）。 */
export async function listProjects(): Promise<StudioProject[]> {
  const db = await openDb();
  try {
    const all = await tx(db, "readonly", (store) => store.getAll() as IDBRequest<StudioProject[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

/** 按 id 读取项目；不存在返回 null。 */
export async function getProject(id: string): Promise<StudioProject | null> {
  const db = await openDb();
  try {
    const found = await tx(db, "readonly", (store) => store.get(id) as IDBRequest<StudioProject | undefined>);
    return found ?? null;
  } finally {
    db.close();
  }
}

/** 新建或覆盖保存项目。 */
export async function putProject(project: StudioProject): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "readwrite", (store) => store.put(project));
  } finally {
    db.close();
  }
}

/** 删除项目。 */
export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "readwrite", (store) => store.delete(id));
  } finally {
    db.close();
  }
}
