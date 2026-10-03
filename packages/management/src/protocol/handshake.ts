/**
 * handshake.ts — 协议握手与能力发现类型
 *
 * 使用场景：桌面端建立连接后的第一个请求（handshake），
 * 依据返回的协议版本、宿主系统与能力列表开放对应界面功能。
 */

/** 宿主操作系统标识（windows / linux；其余值为兜底，界面需做兼容检测） */
export type HostOs = "windows" | "linux" | (string & {});

/** 服务端能力标识；握手返回可用能力列表，界面据此开放功能入口 */
export type ManagementCapability =
  | "services"
  | "logs"
  | "modules"
  | "config"
  | "packs"
  | "players"
  | "updates"
  | "operations"
  | "metrics";

/** handshake 方法结果 */
export interface Handshake {
  legacy?: boolean;
  /** 管理协议版本（见 version.ts） */
  protocolVersion: number;
  /** 平台版本（服务端 CLI 包版本） */
  platformVersion: string;
  /** 宿主系统信息 */
  host: {
    os: HostOs;
    arch: string;
    release: string;
  };
  /** 部署根目录（SFMC_ROOT） */
  root: string;
  /** 当前可用能力列表 */
  capabilities: ManagementCapability[];
  /** 守护进程 PID（管理操作的实际执行者） */
  daemonPid: number;
  /** 守护进程启动时间（ISO） */
  daemonStartedAt: string;
  /** 部署是否已完成初始化向导（未初始化时界面应引导新建/接入流程） */
  initialized: boolean;
}
