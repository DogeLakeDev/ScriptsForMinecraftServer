/**
 * platform-next.ts — 桌面端提前使用、尚未随平台 0.2.20 发布的管理协议字段
 *
 * 使用场景：日志删除、世界包图标和卸载、备份删除的类型，以及能力位判断。
 * 已发布的守护进程不会宣告这些能力，界面对应入口保持关闭，调用不会发出。
 */
import type { OperationAccepted } from "@sfmc-bds/management";

declare module "@sfmc-bds/management" {
  interface PackRow {
    /** pack_icon.png 的 size:mtime。旧平台没有该字段。 */
    iconStamp?: string;
    /** 平台聚合包。旧平台没有该字段。 */
    protected?: boolean;
  }
  interface LogsTailResult {
    /** 范围内还有更早的日志没有放进 entries。旧平台不返回。 */
    truncated?: boolean;
  }
  interface ManagementMethodMap {
    "logs.delete": { removed: number };
    "packs.icon": { id: string; mime: "image/png" | null; data: string | null };
    "packs.uninstall": OperationAccepted;
    "backups.delete": OperationAccepted;
  }
}

/**
 * 判断握手能力列表里有没有某一项。
 * 使用场景：新能力还没写进已发布平台的类型联合时，仍要按字符串判断，避免把旧平台误判成类型错误。
 */
export function hasCapability(capabilities: readonly string[] | undefined, name: string): boolean {
  return Boolean(capabilities?.includes(name));
}
