/**
 * nav.ts — 工作区导航注册表
 *
 * 使用场景：侧边栏导航、标题栏面包屑、命令面板与快捷键（Ctrl+1…9）都从这里读取页面元数据。
 * 新增页面只需追加一项并在 App 的页面表中注册组件（OCP），能力门控与原实现的 capNames 映射一致。
 */
import type { ManagementCapability } from "@sfmc-bds/management";
import type { IconName } from "../components/icons.js";

/** 页面标识（与原实现的 NAV key 保持一致） */
export type PageKey = "overview" | "logs" | "modules" | "config" | "packs" | "players" | "updates" | "tasks" | "studio";

/** 单个导航项 */
export interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
  /** 侧边栏分组名 */
  group: "运行" | "内容" | "维护" | "开发工具";
  /** 实例页面所需的握手能力；省略表示无需实例的本地工具 */
  capability?: ManagementCapability;
  /** 命令面板中的辅助检索词 */
  keywords: string;
}

export const NAV: NavItem[] = [
  {
    key: "overview",
    label: "服务总览",
    icon: "overview",
    group: "运行",
    capability: "services",
    keywords: "overview services 服务 状态 启动 停止",
  },
  {
    key: "logs",
    label: "日志控制台",
    icon: "terminal",
    group: "运行",
    capability: "logs",
    keywords: "logs console 日志 控制台 命令",
  },
  {
    key: "tasks",
    label: "任务记录",
    icon: "history",
    group: "运行",
    capability: "operations",
    keywords: "tasks operations 任务 进度 记录",
  },
  {
    key: "modules",
    label: "模块管理",
    icon: "modules",
    group: "内容",
    capability: "modules",
    keywords: "modules 模块 插件 安装",
  },
  {
    key: "packs",
    label: "世界包",
    icon: "package",
    group: "内容",
    capability: "packs",
    keywords: "packs 行为包 资源包 addon",
  },
  {
    key: "config",
    label: "配置",
    icon: "sliders",
    group: "内容",
    capability: "config",
    keywords: "config 配置 server.properties",
  },
  {
    key: "players",
    label: "玩家与权限",
    icon: "users",
    group: "维护",
    capability: "players",
    keywords: "players 玩家 权限 允许名单 allowlist",
  },
  {
    key: "updates",
    label: "更新与备份",
    icon: "refresh",
    group: "维护",
    capability: "updates",
    keywords: "updates backups 更新 升级 备份 恢复",
  },
  {
    key: "studio",
    label: "UI Studio",
    icon: "pencil",
    group: "开发工具",
    keywords: "ui studio editor 界面 表单 编辑器 可视化 设计",
  },
];

/** 按 key 取导航项 */
export const navItem = (key: PageKey) => NAV.find((item) => item.key === key)!;
