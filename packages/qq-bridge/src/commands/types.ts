/**
 * commands/types.ts — QQ 侧指令契约（与 backend 无关）
 */

export type QqBackendKind = "official" | "llbot";

export type CommandButton = {
  id: string;
  label: string;
  /** 点击/编号后触发的指令文本，或 INTERACTION 回调 data（见 actionType） */
  command: string;
  /**
   * 官方键盘：0=跳转 1=回调（INTERACTION）2=指令（默认）
   * llbot 忽略，一律走编号会话执行 command。
   */
  actionType?: 0 | 1 | 2;
  style?: number;
  visitedLabel?: string;
  permission?: {
    type: 0 | 1 | 2;
    specify_user_ids?: string[];
    specify_role_ids?: string[];
  };
};

export type CommandResult = {
  /** 纯文本正文（llbot 直接用；official 可再包一层 markdown） */
  text: string;
  /** 可选 Markdown（official 优先；无则用 text） */
  markdown?: string;
  buttons?: CommandButton[];
};

export type InboundMessage = {
  backend: QqBackendKind;
  groupId: string;
  userId: string;
  userName: string;
  text: string;
  msgId?: string;
  /** 官方群聊或单聊；缺省按 group */
  scene?: "group" | "c2c";
  /**
   * 是否为 QQ 群主/群管理员（llbot: sender.role；官方：事件里若有 roles 则解析）。
   * 是否视为 SFMC 管理员由 configs/qq_link.json 的 treat_group_admins_as_admins 决定。
   */
  isGroupAdmin?: boolean;
};

export type CommandContext = {
  inbound: InboundMessage;
  /** 进程启动时刻，供 ping 展示 uptime */
  startedAt: number;
  /** 运行摘要（sandbox 等），由入口注入；handler 不读 qq_backend 分支业务 */
  runtimeInfo: {
    sandbox?: boolean;
    appIdHint?: string;
    /** db-server 地址，供 status / bind */
    dbHost?: string;
    dbPort?: number;
    /** 官方群 openid（群信息 / 审批通知） */
    groupOpenid?: string;
    /** QQ 管理员 openid */
    adminOpenids?: string[];
    /** 游戏聊天互通频道（只读提示用） */
    bridgeChannelId?: string;
    /** official 凭证，供群 OpenAPI / 主动推送审批消息 */
    officialCreds?: {
      appId: string;
      appSecret: string;
      sandbox?: boolean;
    };
  };
};

export type CommandHandler = (ctx: CommandContext) => CommandResult | Promise<CommandResult>;

export type RegisteredCommand = {
  /** 主名，如 ping */
  name: string;
  /** 触发词（已小写/规范化匹配前再处理） */
  aliases: string[];
  description: string;
  handler: CommandHandler;
  /**
   * 管理子菜单项：不出现在主「菜单」/官方 C2C 菜单前排；
   * 仍可通过触发词直接调用。
   */
  adminMenu?: boolean;
};

export type ReplyTarget = {
  groupId: string;
  msgId?: string;
};

export type ReplyPort = {
  send(target: ReplyTarget, result: CommandResult, inbound: InboundMessage): Promise<void>;
};
