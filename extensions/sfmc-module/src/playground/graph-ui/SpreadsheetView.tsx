import { useEffect, useMemo, useState } from "react";
import { vscodeApi } from "./vscodeApi";
import { ScrollArea } from "./ScrollArea";

export type SpreadsheetRow = Record<string, unknown> & { id: string };

export type SpreadsheetColumn = {
  key: string;
  label: string;
  value: (row: SpreadsheetRow) => unknown;
};

export type SpreadsheetTable = {
  key: string;
  title: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
};

type InspectSnapshot = {
  id: string;
  kind: string;
  props: Record<string, unknown>;
};

type PendingInspect = {
  resolve: (value: InspectSnapshot) => void;
  reject: (reason: Error) => void;
};

const pendingInspects = new Map<string, PendingInspect>();

function requestInspect(id: string): Promise<InspectSnapshot> {
  return new Promise((resolve, reject) => {
    const requestId = `spreadsheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingInspects.set(requestId, { resolve, reject });
    vscodeApi().postMessage({ cmd: "inspect", requestId, id });
    window.setTimeout(() => {
      if (!pendingInspects.has(requestId)) return;
      pendingInspects.delete(requestId);
      reject(new Error("inspect 请求超时"));
    }, 60000);
  });
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function InspectDrawer({ objectId, onClose }: { objectId: string; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<InspectSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setError(null);
    void requestInspect(objectId).then(
      (result) => {
        if (active) setSnapshot(result);
      },
      (reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      }
    );
    return () => {
      active = false;
    };
  }, [objectId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const rows = Object.entries(snapshot?.props ?? {});

  return (
    <div className="inspect-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="inspect-drawer"
        aria-label={`${objectId} inspect`}
        aria-modal="true"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inspect-drawer-header">
          <div>
            <div className="inspect-drawer-kind">{snapshot?.kind ?? "Inspect"}</div>
            <div className="inspect-drawer-id" title={objectId}>
              {objectId}
            </div>
          </div>
          <button type="button" className="inspect-drawer-close" aria-label="关闭 inspect" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="inspect-drawer-body">
          {error ? <div className="inspect-drawer-status error">{error}</div> : null}
          {!error && !snapshot ? <div className="inspect-drawer-status">读取中…</div> : null}
          {snapshot ? (
            <div className="inspect-property-table">
              <div className="inspect-property-th">Key</div>
              <div className="inspect-property-th">Value</div>
              <div className="inspect-property-th">Type</div>
              {rows.flatMap(([key, value]) => [
                <div key={`${key}-key`}>{key}</div>,
                <div key={`${key}-value`} title={formatValue(value)}>
                  {formatValue(value)}
                </div>,
                <div key={`${key}-type`}>{valueType(value)}</div>,
              ])}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SpreadsheetTableView({ table, onInspect }: { table: SpreadsheetTable; onInspect: (id: string) => void }) {
  const [sort, setSort] = useState<SortState | null>(null);
  const rows = useMemo(() => {
    if (!sort) return table.rows;
    const column = table.columns.find((candidate) => candidate.key === sort.key);
    if (!column) return table.rows;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...table.rows].sort((left, right) => compareValues(column.value(left), column.value(right)) * direction);
  }, [sort, table]);

  const toggleSort = (key: string) => {
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <section className="spreadsheet-section">
      <div className="spreadsheet-title">
        <span>{table.title}</span>
        <span className="spreadsheet-count">{table.rows.length}</span>
      </div>
      <ScrollArea className="spreadsheet-scroll">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  <button type="button" onClick={() => toggleSort(column.key)}>
                    <span>{column.label}</span>
                    <span className="spreadsheet-sort" aria-hidden="true">
                      {sort?.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onInspect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onInspect(row.id);
                }}
              >
                {table.columns.map((column) => {
                  const value = column.value(row);
                  return (
                    <td key={column.key} title={formatValue(value)}>
                      {formatValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr className="spreadsheet-empty-row">
                <td colSpan={table.columns.length}>暂无对象</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollArea>
    </section>
  );
}

export function SpreadsheetView({ tables }: { tables: SpreadsheetTable[] }) {
  const [inspectId, setInspectId] = useState<string | null>(null);

  useEffect(() => {
    const receiveResult = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== "object" || message.type !== "rpcResult" || !message.requestId) return;
      const pending = pendingInspects.get(String(message.requestId));
      if (!pending) return;
      pendingInspects.delete(String(message.requestId));
      if (message.error) pending.reject(new Error(String(message.error)));
      else pending.resolve(message.result as InspectSnapshot);
    };
    window.addEventListener("message", receiveResult);
    return () => window.removeEventListener("message", receiveResult);
  }, []);

  return (
    <>
      <div className="spreadsheet-view">
        {tables.map((table) => (
          <SpreadsheetTableView key={table.key} table={table} onInspect={setInspectId} />
        ))}
      </div>
      {inspectId ? <InspectDrawer objectId={inspectId} onClose={() => setInspectId(null)} /> : null}
    </>
  );
}
