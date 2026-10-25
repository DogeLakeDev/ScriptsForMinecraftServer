/**
 * local-methods.ts — 管理通道在 stdio 进程内直接作答的只读方法
 *
 * 使用场景：stdio.ts 收到这些方法时不转发给常驻守护进程，而是用磁盘上的新代码读取数据库，
 * 平台升级后不必重启仍在托管服务的守护进程即可使用；server.ts 握手时声明对应能力。
 * 守护进程握手结果由旧代码生成时，stdio.ts 也会补上 LOCAL_CAPABILITIES。
 * 新增此类只读方法时在这里登记（OCP）。
 */
import type { ManagementCapability, ManagementMethod } from "@sfmc-bds/management";

/** 在 stdio 进程内直接分派给 dispatchManagement 的方法 */
export const LOCAL_METHODS: ReadonlySet<string> = new Set<ManagementMethod>(["players.list", "activity.query", "activity.stats"]);

/**
 * 由本地方法提供、需要在握手中声明的能力。
 * scoreboard 的两个方法由 stdio.ts 单独分派（写入要转交守护进程），不在 LOCAL_METHODS 中，但同样不依赖守护进程版本。
 */
export const LOCAL_CAPABILITIES: readonly ManagementCapability[] = ["activity", "scoreboard"];
