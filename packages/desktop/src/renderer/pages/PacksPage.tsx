/**
 * PacksPage.tsx — 世界包（行为包与资源包）
 *
 * 使用场景：查看当前世界已安装的包、版本与图标，切换启用状态，卸载，或导入 .mcpack/.mcaddon/.zip。
 * 导入可以多选，也可以把多个文件拖进页面。文件先上传到实例收件箱，再提交一次 packs.import。
 * 卸载走 packs.uninstall：平台聚合包不可卸；行为包的配对资源包会一并移入回收站。
 */
import type { PackRow } from "@sfmc-bds/management";
import { useEffect, useState, type DragEvent as ReactDragEvent } from "react";
import { useDesktop } from "../app/desktop.js";
import { hasCapability } from "../../shared/platform-next.js";
import { Button, IconButton, SearchInput, Segmented, Switch } from "../components/controls.js";
import { toast, useConfirm } from "../components/feedback.js";
import { ManualRestartNotice, RestartServicesButton, useManualRestartSupport } from "../components/RestartServicesButton.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, CopyText, EmptyState, IconTile, PageHeader, Surface } from "../components/ui.js";
import { plainMinecraft } from "../lib/format.js";

/** 世界包归档后缀。使用场景：拖入文件时先筛掉其他类型，主进程复制前会再检查一次。 */
const PACK_FILE = /\.(mcpack|mcaddon|zip)$/i;

function dragHasFiles(transfer: DataTransfer | null) {
  return Boolean(transfer && Array.from(transfer.types).includes("Files"));
}

/** 收件箱文件名去掉时间戳前缀，给确认框看原文件名。 */
function inboxLabel(filename: string) {
  return filename.replace(/^\d+-/, "");
}

/** 已拉取的世界包图标。键是「实例:包 id:iconStamp」，名单每 5 秒刷新时不重复下载。 */
const packIconCache = new Map<string, string>();
const PACK_ICON_CACHE_LIMIT = 200;

function rememberPackIcon(key: string, url: string) {
  if (packIconCache.has(key)) packIconCache.delete(key);
  packIconCache.set(key, url);
  while (packIconCache.size > PACK_ICON_CACHE_LIMIT) {
    const oldest = packIconCache.keys().next().value;
    if (oldest === undefined) break;
    packIconCache.delete(oldest);
  }
}

/** 世界包标记：有 pack_icon.png 时显示图片，否则用行为包或资源包色块。 */
function PackGlyph({ row }: { row: PackRow }) {
  const { current, model, request } = useDesktop();
  const canIcons = hasCapability(model.handshake?.capabilities, "pack-icons");
  const cacheKey = canIcons && row.iconStamp ? `${current}:${row.id}:${row.iconStamp}` : "";
  const [src, setSrc] = useState(() => (cacheKey ? packIconCache.get(cacheKey) ?? "" : ""));
  useEffect(() => {
    if (!cacheKey) { setSrc(""); return; }
    const cached = packIconCache.get(cacheKey);
    if (cached) { setSrc(cached); return; }
    let cancelled = false;
    request("packs.icon", { id: row.id })
      .then((result) => {
        if (cancelled || result.mime !== "image/png" || !result.data || !/^[A-Za-z0-9+/=\s]+$/.test(result.data)) return;
        const url = `data:image/png;base64,${result.data}`;
        rememberPackIcon(cacheKey, url);
        setSrc(url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cacheKey, request, row.id]);
  if (src) return <img className="pack-icon" src={src} alt="" />;
  return <IconTile icon={row.kind === "behavior" ? "cube" : "image"} tone={row.kind === "behavior" ? "pastel-2" : "pastel-1"} size={32} />;
}

export function PacksPage() {
  const { model, editable: connectedEditable, submit, request, guarded, current } = useDesktop();
  const confirm = useConfirm();
  const supportsManualRestart = useManualRestartSupport();
  const editable = connectedEditable && supportsManualRestart;
  const canUninstall = hasCapability(model.handshake?.capabilities, "pack-uninstall");
  const canBatch = hasCapability(model.handshake?.capabilities, "pack-import-batch");
  const [kind, setKind] = useState<"all" | "behavior" | "resource">("all");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const behavior = model.packs.filter((row) => row.kind === "behavior").length;
  const rows = model.packs.filter((row) => (kind === "all" || row.kind === kind) && `${plainMinecraft(row.name)} ${row.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const importPacks = (paths?: string[] | (() => string[])) =>
    void guarded(async () => {
      const selected = typeof paths === "function" ? paths() : paths;
      const uploaded = await window.sfmc.uploadPack(current, selected);
      if (!uploaded?.length) return;
      const labels = uploaded.map((row) => inboxLabel(row.filename));
      const title = labels.length === 1 ? "导入世界包" : `导入 ${labels.length} 个世界包`;
      const description = labels.length === 1
        ? `已上传 ${labels[0]}。将安装到当前世界并启用，可在导入完成后手动重启 BDS。`
        : `已上传 ${labels.join("、")}。将依次安装到当前世界并启用。若其中一个失败，已经安装的包会保留。完成后可手动重启 BDS。`;
      if (canBatch || labels.length === 1) {
        await submit("packs.import", canBatch ? { filenames: uploaded.map((row) => row.filename) } : { filename: uploaded[0]?.filename }, title, { description, okText: "导入" });
        return;
      }
      await confirm({
        title,
        description,
        note: "任务提交后在后台执行，关闭客户端不会取消任务。",
        okText: "导入",
        icon: "upload",
        onConfirm: async () => {
          for (const row of uploaded) await request("packs.import", { filename: row.filename });
        },
      });
    });
  const onDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setDragging(true);
  };
  const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = editable ? "copy" : "none";
    setDragging(true);
  };
  const onDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDragging(false);
  };
  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setDragging(false);
    if (!editable) {
      toast.error("当前不能导入世界包");
      return;
    }
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of event.dataTransfer.files) {
      if (PACK_FILE.test(file.name)) accepted.push(file);
      else rejected.push(file.name);
    }
    if (rejected.length) toast.warning("已跳过不支持的文件", rejected.join("、"));
    if (!accepted.length) {
      if (!rejected.length) toast.error("没有可导入的世界包", "请拖入 .mcpack、.mcaddon 或 .zip");
      return;
    }
    importPacks(() => accepted.map((file) => {
      const value = window.sfmc.packFilePath(file);
      if (!value) throw new Error(`无法读取 ${file.name} 的路径`);
      return value;
    }));
  };
  return (
    <div className={`page pack-drop${dragging ? " is-dragging" : ""}`} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <PageHeader
        title="世界包"
        actions={<><RestartServicesButton /><Tooltip content={editable ? "可多选，或把文件拖进这个页面" : "当前为只读"} wrap><Button variant="primary" disabled={!editable} icon="upload" onClick={() => importPacks()}>导入世界包</Button></Tooltip></>}
      />
      <ManualRestartNotice />
      <Surface flush>
        {dragging && <p className="pack-drop-hint">{editable ? "松开即可导入。可以一次拖入多个 .mcpack、.mcaddon 或 .zip" : "当前为只读"}</p>}
        <div className="list-toolbar">
          <SearchInput size="sm" placeholder="按名称或 UUID 筛选" aria-label="筛选世界包" value={query} onChange={setQuery} className="toolbar-search" />
          <Segmented
            size="sm"
            label="包类型"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "全部", count: model.packs.length },
              { value: "behavior", label: "行为包", count: behavior },
              { value: "resource", label: "资源包", count: model.packs.length - behavior },
            ]}
          />
        </div>
        {rows.length ? (
          <ul className="row-list">
            {rows.map((row) => (
              <li key={row.id} className={`row-item${row.enabled ? "" : " muted-row"}`}>
                <PackGlyph row={row} />
                <div className="row-main">
                  <div className="row-title">
                    <b title={plainMinecraft(row.name)}>{plainMinecraft(row.name)}</b>
                    <Badge tone={row.kind === "behavior" ? "accent" : "info"}>{row.kind === "behavior" ? "行为包" : "资源包"}</Badge>
                    {row.protected && <Badge tone="neutral">平台包</Badge>}
                  </div>
                  <CopyText text={row.id} className="row-sub" />
                </div>
                <Badge className="mono row-version" title="世界包版本">v{row.version}</Badge>
                <div className="row-actions">
                  <Tooltip content={editable ? (row.enabled ? "停用世界包" : "启用世界包") : "当前为只读"} wrap>
                    <Switch size="sm" label={`${row.enabled ? "停用" : "启用"} ${plainMinecraft(row.name)}`} checked={row.enabled} disabled={!editable} onChange={(enabled) => void submit("packs.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"} ${plainMinecraft(row.name)}`, { description: "将保存世界包状态，可在操作完成后手动重启 BDS 使更改生效。" })} />
                  </Tooltip>
                  {canUninstall && (
                    <Tooltip content={!editable ? "当前为只读" : row.protected ? "平台聚合包请在模块管理中卸载" : "卸载世界包"} wrap>
                      <IconButton
                        icon="trash"
                        label={`卸载 ${plainMinecraft(row.name)}`}
                        size="sm"
                        danger
                        tooltip={false}
                        disabled={!editable || row.protected}
                        onClick={() => void submit("packs.uninstall", { id: row.id }, `卸载 ${plainMinecraft(row.name)}`, {
                          danger: true,
                          okText: "卸载",
                          description: "将从当前世界移走该包。默认进入卸载回收站。若这是行为包且带有配对资源包，会一起移走。完成后可手动重启 BDS。",
                        })}
                      />
                    </Tooltip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="package"
            title={model.packs.length ? "没有匹配的世界包" : "当前世界没有安装世界包"}
            description={!model.packs.length ? "把 .mcpack、.mcaddon 或 .zip 拖进页面，也可以一次选择多个文件" : undefined}
            action={model.packs.length ? <Button size="sm" onClick={() => { setQuery(""); setKind("all"); }}>清除筛选</Button> : <Button disabled={!editable} icon="upload" onClick={() => importPacks()}>导入世界包</Button>}
          />
        )}
      </Surface>
    </div>
  );
}
