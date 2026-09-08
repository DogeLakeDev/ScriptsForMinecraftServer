/**
 * server-properties-i18n.ts — BDS server.properties 多语言注释字典
 */

export interface ServerPropertyDoc {
  /** 中文功能概述 */
  desc: string;
  /** 合法取值与枚举说明 */
  values?: string;
  /** 避坑、性能或安全性提示 */
  tip?: string;
}

export const SERVER_PROPERTIES_DOCS_ZH_CN: Record<string, ServerPropertyDoc> = {
  "server-name": {
    desc: "服务器名称（显示在客户端局域网/好友列表中）",
    values: "任意字符串（请勿包含分号 ;）",
  },
  "gamemode": {
    desc: "新玩家首次加入世界时的默认游戏模式",
    values: "survival (生存) | creative (创造) | adventure (冒险)",
  },
  "force-gamemode": {
    desc: "是否强制玩家每次重新连接时都重置为默认游戏模式",
    values: "true (每次进服强制转为默认模式) | false (保留玩家上次离线时的模式)",
  },
  "difficulty": {
    desc: "游戏世界的默认难度",
    values: "peaceful (和平) | easy (简单) | normal (普通) | hard (困难)",
  },
  "allow-cheats": {
    desc: "是否允许在控制台或游戏内使用管理员指令（作弊模式）",
    values: "true | false",
    tip: "若开启此项，加入该世界的玩家将无法获得 Xbox 成就",
  },
  "max-players": {
    desc: "允许同时在线的最大玩家数量限制",
    values: "正整数（如 10、20）",
  },
  "online-mode": {
    desc: "是否开启微软 Xbox Live 正版身份验证",
    values: "true (仅允许正版微软账号登录) | false (允许离线免登录连接，但易受假人攻击)",
    tip: "公网服务器强烈建议设为 true 以防止恶意伪造身份",
  },
  "white-list": {
    desc: "是否开启准入白名单验证（部分版本对应 allow-list）",
    values: "true (仅允许白名单中的玩家进入) | false (所有玩家均可进入)",
  },
  "allow-list": {
    desc: "是否开启准入白名单验证（需配合 allowlist.json 使用）",
    values: "true (仅允许白名单中的玩家进入) | false (所有玩家均可进入)",
  },
  "server-port": {
    desc: "服务端监听的 IPv4 UDP 网络通信端口",
    values: "1 ~ 65535（默认：19132）",
  },
  "server-portv6": {
    desc: "服务端监听的 IPv6 UDP 网络通信端口",
    values: "1 ~ 65535（默认：19133）",
  },
  "enable-lan-visibility": {
    desc: "是否向局域网广播本服务器（使同局域网玩家能在客户端「好友」列表中直接发现）",
    values: "true | false",
  },
  "view-distance": {
    desc: "服务端向客户端发送地图区块的最大视距（单位：区块）",
    values: "正整数（建议 12 ~ 32，数值越大网络与内存消耗越高）",
  },
  "tick-distance": {
    desc: "世界实体逻辑与方块更新的模拟计算距离（单位：区块）",
    values: "4 ~ 12（数值越小服务器性能越好，低配机型推荐 4）",
  },
  "player-idle-timeout": {
    desc: "玩家挂机无操作自动踢出超时时间（单位：分钟）",
    values: "0 (永不踢出) 或大于 0 的整数",
  },
  "max-threads": {
    desc: "BDS 运行可使用的最大工作线程数",
    values: "0 (由服务端根据 CPU 核心数自动分配) 或指定线程数",
  },
  "level-name": {
    desc: "要加载的世界存档文件夹名称（对应 worlds/ 目录下的子文件夹）",
    values: "文件夹名称（默认：Bedrock level）",
  },
  "level-seed": {
    desc: "全新世界生成时的随机种子",
    values: "任意数字或文本（留空则每次新建世界随机生成）",
  },
  "default-player-permission-level": {
    desc: "新玩家首次加入时的默认权限级别",
    values: "visitor (访客，不可破坏或交互) | member (普通成员) | operator (操作员)",
  },
  "texturepack-required": {
    desc: "是否强制玩家下载服务器指定的材质资源包后才能加入",
    values: "true (必须下载) | false (可选下载)",
  },
  "content-log-console-output-enabled": {
    desc: "是否将内容日志（模组/行为包解析警告、SAPI 脚本报错与 console.log）实时输出到控制台",
    values: "true | false",
    tip: "开发或调试模组时强烈建议设为 true，以便即时查看错误",
  },
  "compression-threshold": {
    desc: "网络数据包启用压缩的最小字节阈值",
    values: "0 (全部压缩) ~ 65535 字节（1.20+ 默认通常为 1）",
  },
  "compression-algorithm": {
    desc: "网络传输数据包的压缩算法",
    values: "zlib (标准高压缩比) | snappy (高性能低延迟，CPU 开销小)",
  },
  "server-authoritative-movement": {
    desc: "玩家移动验证权威模式",
    values: "server-auth (服务端权威判定) | client-auth (客户端权威)",
  },
  "player-movement-score-threshold": {
    desc: "玩家移动异常被判定为作弊的累计异常分阈值",
    values: "整数（默认 20）",
  },
  "player-movement-action-direction-threshold": {
    desc: "玩家攻击或破坏动作与视线朝向夹角偏差的判定阈值",
    values: "浮点数（默认 0.85）",
  },
  "player-movement-distance-threshold": {
    desc: "玩家单次位移超出正常范围的判定阈值",
    values: "浮点数（默认 0.3）",
  },
  "player-movement-duration-threshold-in-ms": {
    desc: "移动异常判定采样的滑动时间窗口（单位：毫秒）",
    values: "整数（默认 500）",
  },
  "correct-player-movement": {
    desc: "当检测到玩家移动作弊或超标时，是否强制将其拉回合法位置（防飞天/加速）",
    values: "true (强制回拉纠正) | false (仅在后台记录警告)",
  },
  "server-authoritative-block-breaking": {
    desc: "方块破坏动作是否由服务端权威判定（防止变速刷方块等作弊行为）",
    values: "client-auth | server-auth",
  },
  "chat-restriction": {
    desc: "聊天过滤限制策略",
    values: "None (无限制) | Dropped (静默丢弃违规内容) | Disabled (完全禁用聊天)",
  },
  "disable-player-interaction": {
    desc: "是否禁用静默交互检测（用于排查网络延迟或防快速交互）",
    values: "true | false",
  },
  "client-side-chunk-generation-enabled": {
    desc: "是否允许客户端在本地生成尚未加载的地形区块（加快长距离探索时的视觉加载速度）",
    values: "true (允许客户端本地预生成) | false (全部由服务端生成并传输)",
  },
  "block-network-ids-are-hashes": {
    desc: "方块在网络传输中的唯一标识是否采用哈希值",
    values: "true | false",
  },
  "disable-persona": {
    desc: "是否禁用个性化装扮/角色创建器（Persona 皮肤）",
    values: "true (强制使用经典皮肤) | false (允许使用官方捏脸角色)",
  },
  "disable-custom-skins": {
    desc: "是否禁用玩家上传的自定义经典皮肤（防止恶意或透明皮肤）",
    values: "true (禁用自定义皮肤) | false (允许自定义皮肤)",
  },
  "emit-server-telemetry": {
    desc: "是否向 Mojang 发送服务器遥测与运行健康诊断数据",
    values: "true | false",
    tip: "使用本平台时因您已同意 Mojang EULA 协议，按协议保持启用",
  },
  "server-build-radius-ratio": {
    desc: "允许玩家建造和交互的世界区域半径比例",
    values: "Disabled (无限制) 或 0.0 ~ 1.0 的浮点数",
  },
  "allow-outbound-script-debugging": {
    desc: "是否允许服务端脚本主动连接外部调试器（允许 /script debugger connect 指令）",
    values: "true | false",
    tip: "仅在通过 VS Code 调试 SAPI 模组时开启，生产环境建议关闭",
  },
  "allow-inbound-script-debugging": {
    desc: "是否允许外部脚本调试器主动连接服务端（允许 /script debugger listen 指令）",
    values: "true | false",
    tip: "仅在通过 VS Code 调试 SAPI 模组时开启，生产环境建议关闭",
  },
  "force-inbound-debug-port": {
    desc: "脚本调试器监听的专属网络端口",
    values: "1 ~ 65535（默认：19144）",
  },
  "script-debugger-auto-attach": {
    desc: "世界加载时，是否自动连接或监听外部脚本调试器",
    values: "disabled (不自动附加) | connect (自动向外连接) | listen (自动开启端口监听)",
  },
  "script-debugger-auto-attach-connect-address": {
    desc: "当 auto-attach 设为 connect 时，尝试连接的目标调试器主机与端口",
    values: "ip:port（例如 localhost:19144）",
  },
  "websocket-retry-time": {
    desc: "连接外部 WebSocket 服务器断开后的自动重试间隔（单位：秒）",
    values: "正整数（默认 20）",
  },
};

/**
 * 根据属性 key 和目标语言获取说明文档
 */
export function getServerPropertyDoc(key: string, locale: string = "zh-CN"): ServerPropertyDoc | undefined {
  const normalizedKey = key.trim().toLowerCase();
  const normalizedLocale = locale.toLowerCase();

  if (normalizedLocale === "zh" || normalizedLocale.startsWith("zh-")) {
    return SERVER_PROPERTIES_DOCS_ZH_CN[normalizedKey];
  }
  return undefined;
}
