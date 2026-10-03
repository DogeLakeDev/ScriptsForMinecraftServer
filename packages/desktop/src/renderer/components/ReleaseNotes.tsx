import type { ReleaseNotes as ReleaseNotesInfo } from "@sfmc-bds/management";
import { Fragment, type ReactNode } from "react";
import { Button } from "./controls.js";
import { fullTime } from "../lib/format.js";

/** 以 React 文本节点展示发行说明，不执行发行正文里的 HTML。 */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\([^)]+\)$/.exec(part);
    return <Fragment key={index}>{link ? link[1] : part}</Fragment>;
  });
}
function Body({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index]!;
    if (!line.trim()) { index++; continue; }
    if (/^```/.test(line)) {
      const code: string[] = []; index++;
      while (index < lines.length && !/^```/.test(lines[index]!)) code.push(lines[index++]!);
      index++; blocks.push(<pre key={index}><code>{code.join("\n")}</code></pre>); continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) { blocks.push(<h4 key={index}>{inline(heading[1]!)}</h4>); index++; continue; }
    const list = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const items: ReactNode[] = []; const ordered = /^\s*\d+\./.test(line);
      const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*]\s+(.+)$/;
      while (index < lines.length) {
        const item = pattern.exec(lines[index]!);
        if (!item) break;
        items.push(<li key={index}>{inline(item[1]!)}</li>); index++;
      }
      blocks.push(ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>); continue;
    }
    const paragraph = [line]; index++;
    while (index < lines.length && lines[index]!.trim() && !/^(?:#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|```)/.test(lines[index]!)) paragraph.push(lines[index++]!);
    blocks.push(<p key={index}>{inline(paragraph.join("\n"))}</p>);
  }
  return blocks;
}

export function ReleaseNotes({ notes, version, collapsible = false, title = "更新日志" }: { notes?: ReleaseNotesInfo; version: string; collapsible?: boolean; title?: string }) {
  const content = <>
    <div className="release-notes-meta"><span className="mono">v{version}</span>{notes?.publishedAt && <span>{fullTime(notes.publishedAt)}</span>}</div>
    <div className="release-notes-body" tabIndex={0} role="region" aria-label={`版本 ${version} 更新日志`}>
      {notes?.status === "available" ? <Body text={notes.body} /> : <p className="muted">{notes?.status === "empty" ? "此版本暂无更新日志" : notes?.message || "暂未获取到此版本的更新日志"}</p>}
    </div>
    {notes && <Button size="sm" variant="ghost" iconEnd="external" onClick={() => void window.sfmc.openLink("release", notes.url)}>查看发行原文</Button>}
  </>;
  return collapsible ? <details className="release-notes"><summary>{title} <span className="mono">v{version}</span></summary>{content}</details> : <section className="release-notes"><h3>{title}</h3>{content}</section>;
}
