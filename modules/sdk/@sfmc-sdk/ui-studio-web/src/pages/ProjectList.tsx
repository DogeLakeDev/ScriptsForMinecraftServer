/**
 * ProjectList.tsx — Studio 首页：项目列表。
 *
 * 项目存于浏览器 IndexedDB；支持新建、打开、重命名、删除、
 * 导出 zip，以及从 zip 导入整个工程（含 manifest.json 提取 services）。
 */

import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, FolderUp, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  createProject,
  newProjectId,
  type StudioProject,
} from "../store/project";
import { deleteProject, listProjects, putProject } from "../store/db";
import {
  downloadBlob,
  exportProjectZip,
  importProjectFolder,
  importProjectZip,
  type ImportedProject,
} from "../zip";

interface ProjectListProps {
  onOpen(id: string): void;
}

export function ProjectList({ onOpen }: ProjectListProps) {
  const [projects, setProjects] = useState<StudioProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // webkitdirectory 非标准属性，React/TS 不识别，挂载后直接设到 DOM 上。
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const refresh = () => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };
  useEffect(refresh, []);

  const createNew = async () => {
    const name = window.prompt("新项目名称：", "未命名 UI 工程");
    if (name === null) return;
    const project = createProject(name.trim() || "未命名 UI 工程");
    await putProject(project);
    onOpen(project.id);
  };

  /** 导入结果落库并打开（zip 与文件夹共用）。 */
  const openImported = async (imported: ImportedProject) => {
    const now = Date.now();
    const project: StudioProject = {
      id: newProjectId(),
      name: imported.name,
      createdAt: now,
      updatedAt: now,
      files: imported.files,
      services: imported.services,
    };
    await putProject(project);
    onOpen(project.id);
  };

  const importZip = async (file: File) => {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      await openImported(importProjectZip(data, file.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const importFolder = async (list: FileList) => {
    try {
      // 文件夹名取首个文件的相对路径首段。
      const first = list[0];
      const folderName = first?.webkitRelativePath?.split("/")[0] ?? "导入的工程";
      await openImported(await importProjectFolder(list, folderName));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const rename = async (project: StudioProject) => {
    const name = window.prompt("项目名称：", project.name);
    if (name === null || name.trim() === "") return;
    await putProject({ ...project, name: name.trim(), updatedAt: Date.now() });
    refresh();
  };

  const remove = async (project: StudioProject) => {
    if (!window.confirm(`确定删除项目「${project.name}」？此操作不可恢复（可先导出 zip 备份）。`)) return;
    await deleteProject(project.id);
    refresh();
  };

  return (
    <div className="home">
      <header className="studio-header">
        <span className="studio-title">SFMC UI Studio</span>
        <span className="studio-spacer" />
        <button className="btn" onClick={() => importInputRef.current?.click()}>
          <Upload size={14} /> 导入 zip
        </button>
        <button className="btn" onClick={() => folderInputRef.current?.click()}>
          <FolderUp size={14} /> 导入文件夹
        </button>
        <button className="btn btn-primary" onClick={() => void createNew()}>
          <Plus size={14} /> 新建项目
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importZip(file);
            event.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const list = event.target.files;
            if (list && list.length > 0) void importFolder(list);
            event.target.value = "";
          }}
        />
      </header>
      <main className="home-main">
        {error ? <div className="home-error">{error}</div> : null}
        {projects === null ? (
          <div className="app-loading">正在读取项目…</div>
        ) : projects.length === 0 ? (
          <div className="home-empty">
            <p>还没有项目。</p>
            <p>
              点击「新建项目」从零开始；或「导入 zip / 导入文件夹」打开已有的 UI 工程
              （需包含 feature.ui.json，可位于根目录、ui/ 或 sapi/src/ui/；
              manifest.json 会自动提取 service 清单）。
            </p>
          </div>
        ) : (
          <ul className="home-projects">
            {projects.map((project) => (
              <li key={project.id} className="home-project">
                <button className="home-project-open" onClick={() => onOpen(project.id)}>
                  <span className="home-project-title">
                    <FolderOpen size={15} className="home-project-icon" />
                    <span className="home-project-name">{project.name}</span>
                  </span>
                  <span className="home-project-meta">
                    {Object.keys(project.files).length} 个文件 · {project.services.length} 个
                    service · 更新于 {new Date(project.updatedAt).toLocaleString()}
                  </span>
                </button>
                <span className="home-project-actions">
                  <button
                    className="btn"
                    onClick={() =>
                      downloadBlob(exportProjectZip(project), `${project.name}.zip`)
                    }
                  >
                    <Download size={14} /> 导出
                  </button>
                  <button className="btn" onClick={() => void rename(project)}>
                    <Pencil size={14} /> 重命名
                  </button>
                  <button className="btn btn-danger" onClick={() => void remove(project)}>
                    <Trash2 size={14} /> 删除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
