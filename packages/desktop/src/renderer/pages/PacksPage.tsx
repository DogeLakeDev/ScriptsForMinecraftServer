/**
 * PacksPage.tsx — 世界包（行为包与资源包）
 *
 * 使用场景：查看当前世界已安装的包、切换启用状态、导入 .mcpack/.mcaddon/.zip。
 * 导入流程与原实现一致：先通过主进程上传到实例收件箱，再提交 packs.import 任务。
 */
import { useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, SearchInput, Segmented, Switch } from "../components/controls.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, CopyText, EmptyState, IconTile, PageHeader, Surface } from "../components/ui.js";
import { plainMinecraft } from "../lib/format.js";

export function PacksPage() {
  const { model, editable, submit, guarded, current } = useDesktop();
  const [kind, setKind] = useState<"all" | "behavior" | "resource">("all");
  const [query, setQuery] = useState("");
  const behavior = model.packs.filter((row) => row.kind === "behavior").length;
  const rows = model.packs.filter((row) => (kind === "all" || row.kind === kind) && `${plainMinecraft(row.name)} ${row.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const importPack = () =>
    void guarded(async () => {
      const uploaded = await window.sfmc.uploadPack(current);
      if (uploaded) await submit("packs.import", uploaded, "导入世界包并应用", { description: `已上传 ${uploaded.filename.replace(/^\d+-/, "")}。将停服备份后安装到当前世界并启用，随后重启 BDS。` });
    });
  return (
    <div className="page">
      <PageHeader
        title="世界包"
        actions={<Button variant="primary" disabled={!editable} icon="upload" onClick={importPack}>导入世界包</Button>}
      />
      <Surface flush>
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
                <IconTile icon={row.kind === "behavior" ? "cube" : "image"} tone={row.kind === "behavior" ? "pastel-2" : "pastel-1"} size={32} />
                <div className="row-main">
                  <div className="row-title">
                    <b title={plainMinecraft(row.name)}>{plainMinecraft(row.name)}</b>
                    <Badge tone={row.kind === "behavior" ? "accent" : "info"}>{row.kind === "behavior" ? "行为包" : "资源包"}</Badge>
                  </div>
                  <CopyText text={row.id} className="row-sub" />
                </div>
                <span className="row-version mono">v{row.version}</span>
                <Tooltip content={editable ? (row.enabled ? "停用并重启 BDS" : "启用并重启 BDS") : "完成接入后可修改"} wrap>
                  <Switch size="sm" label={`${row.enabled ? "停用" : "启用"} ${plainMinecraft(row.name)}`} checked={row.enabled} disabled={!editable} onChange={(enabled) => void submit("packs.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"} ${plainMinecraft(row.name)}`, { description: "应用世界包状态并重启 BDS。" })} />
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="package"
            title={model.packs.length ? "没有匹配的世界包" : "当前世界没有安装世界包"}
            description={!model.packs.length ? "支持 .mcpack、.mcaddon 和 .zip" : undefined}
            action={model.packs.length ? <Button size="sm" onClick={() => { setQuery(""); setKind("all"); }}>清除筛选</Button> : <Button disabled={!editable} icon="upload" onClick={importPack}>导入世界包</Button>}
          />
        )}
      </Surface>
    </div>
  );
}
