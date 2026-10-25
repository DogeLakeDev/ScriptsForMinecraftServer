/**
 * types.ts — 小程序内共用的类型
 *
 * 使用场景：协议类型统一从 @sfmc-bds/management 引入（仅类型，编译后擦除），页面与核心层不各自声明（DRY）；
 * 另外定义小程序特有的实例档案与界面语气。
 */
export type {
  AttachmentPlan,
  ConfigDocument,
  Handshake,
  LogEntryWire,
  ManagementEvent,
  ManagementMethod,
  ManagementMethodMap,
  ManagementResponse,
  MetricsResult,
  MetricsSample,
  ProcessResources,
  ResourceSample,
  ModuleRow,
  OperationRecord,
  OperationStatus,
  PackRow,
  PlayerRow,
  QqBinding,
  ServiceStateChanged,
  ServiceStatusRow,
} from "@sfmc-bds/management";

/**
 * 一个可管理的实例：网关地址 + 访问令牌。
 * 使用场景：实例列表与编辑页读写，会话层据此建立连接；保存在本机存储，不上传。
 */
export interface InstanceProfile {
  id: string;
  /** 展示名称 */
  name: string;
  /** 网关基础地址，统一保存为 https:// 或 http:// 形式，例如 https://mc.example.com/sfmc */
  endpoint: string;
  /** 网关访问令牌（Authorization: Bearer）；微信身份档案为空字符串 */
  token: string;
  /**
   * 连接凭证来源：缺省或 "token" 为上面填写的访问令牌；
   * "wechat" 为微信登录的玩家会话（网关现查绑定账号是否为 3 级管理员），由「我的 → 进入管理端」自动建立。
   */
  auth?: ProfileAuth;
}

/** 实例档案的凭证来源 */
export type ProfileAuth = "token" | "wechat";

/** 视觉语气：与 styles/base.wxss 的 tone-* 类一一对应 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "progress";
