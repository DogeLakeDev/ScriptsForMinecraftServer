/**
 * server-prop-schema.js — server.properties 属性定义
 * 每条属性包含: key/label/type/values(枚举)/comment(中文说明)
 *
 * 数据来源: Microsoft Learn + server.properties 原文
 * 适用于 Minecraft Bedrock Dedicated Server
 */

const F = (key, label, type, comment, values) => ({ key, label, type, comment, ...(values ? { values } : {}) });

const BOOL = [
  { label: 'true ✓', value: true },
  { label: 'false ✗', value: false },
];

const PROP_SCHEMA = {
  name: 'server.properties',
  desc: 'BDS 服务器主配置文件（修改后需重启生效）',
  fields: [

    // ── 服务器标识 ──
    F('server-name', '服务器名称', 'string', '服务器名称，显示在服务器列表和好友列表中'),
    F('level-name', '世界文件夹名', 'string', '世界文件夹名称（位于 worlds/ 目录下）'),
    F('level-seed', '世界种子', 'string', '世界种子，留空则随机生成；仅在创建新世界时生效'),
    F('level-type', '世界类型', 'enum', '世界类型', [
      { label: '默认 DEFAULT', value: 'DEFAULT' },
      { label: '超平坦 FLAT', value: 'FLAT' },
    ]),

    // ── 网络与端口 ──
    F('server-port', 'IPv4 端口', 'number', 'IPv4 监听端口（范围 1-65535，默认 19132）'),
    F('server-portv6', 'IPv6 端口', 'number', 'IPv6 监听端口（范围 1-65535，默认 19133）'),
    F('enable-lan-visibility', '局域网发现', 'boolean', '启用局域网发现；多服同机建议关闭', BOOL),
    F('online-mode', 'Xbox 验证', 'boolean', '启用 Xbox Live 验证；公服务必开启', BOOL),
    F('allow-list', '白名单', 'boolean', '启用白名单，仅 allowlist.json 中的玩家可加入', BOOL),

    // ── 游戏规则 ──
    F('gamemode', '默认游戏模式', 'enum', '新玩家默认游戏模式', [
      { label: '生存 survival', value: 'survival' },
      { label: '创造 creative', value: 'creative' },
      { label: '冒险 adventure', value: 'adventure' },
    ]),
    F('force-gamemode', '强制游戏模式', 'boolean', '强制玩家每次登录使用默认游戏模式（覆盖世界存档）', BOOL),
    F('difficulty', '难度', 'enum', '世界难度', [
      { label: '和平 peaceful', value: 'peaceful' },
      { label: '简单 easy', value: 'easy' },
      { label: '普通 normal', value: 'normal' },
      { label: '困难 hard', value: 'hard' },
    ]),
    F('allow-cheats', '允许作弊', 'boolean', '允许使用命令（作弊）；开启后会禁用成就', BOOL),
    F('default-player-permission-level', '默认权限', 'enum', '新玩家首次加入时的权限等级', [
      { label: '访客 visitor', value: 'visitor' },
      { label: '成员 member', value: 'member' },
      { label: '管理员 operator', value: 'operator' },
    ]),
    F('player-idle-timeout', '空闲踢出(分)', 'number', '玩家空闲踢出时间（分钟），0=不限制'),
    F('texturepack-required', '强制资源包', 'boolean', '强制客户端接受服务器资源包', BOOL),
    F('chat-restriction', '聊天限制', 'enum', '聊天限制级别', [
      { label: '无限制 None', value: 'None' },
      { label: '丢弃 Dropped（静默丢弃消息）', value: 'Dropped' },
      { label: '禁用 Disabled（隐藏聊天UI）', value: 'Disabled' },
    ]),
    F('disable-player-interaction', '禁用玩家交互', 'boolean', '禁用玩家间交互（非服务端权威）', BOOL),
    F('disable-custom-skins', '禁用自定义皮肤', 'boolean', '禁止使用自定义皮肤（防冒犯性皮肤）', BOOL),
    F('disable-persona', '禁用角色', 'boolean', '禁用角色功能（仅供内部使用）', BOOL),
    F('disable-client-vibrant-visuals', '禁用鲜艳视觉效果', 'boolean', '要求客户端不使用鲜艳视觉效果', BOOL),

    // ── 性能与视距 ──
    F('view-distance', '最大视距', 'number', '最大视距（区块数），≥5；性能关键项，推荐 10-16'),
    F('tick-distance', '模拟距离', 'number', '模拟距离（区块数），范围 4-12；影响生物/红石活动范围'),
    F('max-threads', '最大线程', 'number', '最大线程数，0=自动检测使用全部核心'),
    F('max-players', '最大玩家', 'number', '最大同时在线玩家数，过高影响性能'),
    F('compression-threshold', '压缩阈值', 'number', '网络压缩阈值（字节），0-65535'),
    F('compression-algorithm', '压缩算法', 'enum', '网络压缩算法', [
      { label: 'zlib（CPU 高/带宽低）', value: 'zlib' },
      { label: 'snappy（CPU 低/带宽高）', value: 'snappy' },
    ]),
    F('client-side-chunk-generation-enabled', '客户端区块生成', 'boolean', '允许客户端生成可视区块（减轻服务器压力）', BOOL),
    F('server-build-radius-ratio', '服务端构建比例', 'string', '服务端构建区块比例；Disabled=自动，或 0.0-1.0；需启用客户端区块生成'),

    // ── 方块网络 ──
    F('block-network-ids-are-hashes', '哈希方块 ID', 'boolean', '使用哈希方块网络 ID（稳定不随增删改变）', BOOL),

    // ── 反作弊 / 移动验证 ──
    F('server-authoritative-movement-strict', '严格移动验证', 'boolean', '严格模式：更严格的位置验证，高延迟时影响移动体验', BOOL),
    F('server-authoritative-dismount-strict', '严格下马验证', 'boolean', '严格下马：高延迟时客户端会收到下马位置修正', BOOL),
    F('server-authoritative-entity-interactions-strict', '严格实体交互', 'boolean', '严格实体交互：高延迟时影响玩家间交互', BOOL),
    F('player-position-acceptance-threshold', '位置误差容忍', 'number', '位置误差容忍度（方块）；超过 1.0 增加作弊风险'),
    F('player-movement-action-direction-threshold', '攻击方向偏差', 'number', '攻击与视线方向偏差容忍度（0-1）；1=必须完全一致'),
    F('server-authoritative-block-breaking-pick-range-scalar', '挖掘距离倍数', 'number', '方块挖掘距离倍数（≥1.0），数值平方后乘以默认范围'),

    // ── 内容日志 ──
    F('content-log-file-enabled', '日志写入文件', 'boolean', '将内容错误写入日志文件', BOOL),
    F('content-log-console-output-enabled', '日志输出到控制台', 'boolean', '将内容错误输出到控制台', BOOL),
    F('content-log-level', '日志级别', 'enum', '最低内容日志级别', [
      { label: '错误 error', value: 'error' },
      { label: '警告 warning', value: 'warning' },
      { label: '信息 info', value: 'info' },
      { label: '详细 verbose', value: 'verbose' },
    ]),

    // ── 脚本调试 ──
    F('allow-outbound-script-debugging', '出站调试', 'boolean', '允许脚本调试器 connect 模式和出站连接', BOOL),
    F('allow-inbound-script-debugging', '入站调试', 'boolean', '允许脚本调试器 listen 模式和入站连接', BOOL),
    F('force-inbound-debug-port', '调试端口', 'number', '入站调试端口（默认 19144）；listen 模式需要'),
    F('script-debugger-auto-attach', '自动附加调试器', 'enum', '启动时自动附加调试器', [
      { label: '禁用 disabled', value: 'disabled' },
      { label: '连接 connect', value: 'connect' },
      { label: '监听 listen', value: 'listen' },
    ]),
    F('script-debugger-auto-attach-connect-address', '调试器连接地址', 'string', 'connect 模式连接地址（host:port）'),
    F('script-debugger-auto-attach-timeout', '调试器超时(秒)', 'number', '等待调试器附加超时（秒）'),

    // ── 脚本看门狗 ──
    F('script-watchdog-enable', '启用看门狗', 'boolean', '启用看门狗', BOOL),
    F('script-watchdog-enable-exception-handling', '看门狗异常处理', 'boolean', '启用看门狗异常处理（通过 events.beforeWatchdogTerminate）', BOOL),
    F('script-watchdog-enable-shutdown', '看门狗异常关闭', 'boolean', '看门狗异常时关闭服务器', BOOL),
    F('script-watchdog-hang-exception', '挂起异常', 'boolean', '发生挂起时抛出严重异常', BOOL),
    F('script-watchdog-hang-threshold', '挂起阈值(ms)', 'number', '单 tick 挂起阈值（毫秒，默认 10000）'),
    F('script-watchdog-spike-threshold', '峰值阈值', 'number', '单 tick 峰值阈值（不设置则禁用警告）'),
    F('script-watchdog-slow-threshold', '慢脚本阈值', 'number', '多 tick 慢脚本阈值（不设置则禁用警告）'),
    F('script-watchdog-memory-warning', '内存警告(MB)', 'number', '脚本内存警告阈值（MB，0=禁用，默认 100，最大 2000）'),
    F('script-watchdog-memory-limit', '内存上限(MB)', 'number', '脚本内存上限（MB，超限保存世界并关闭，0=禁用，默认 250，最大 2000）'),

    // ── 诊断 ──
    F('diagnostics-capture-auto-start', '自动诊断捕获', 'boolean', '启动时自动开始诊断捕获', BOOL),
    F('diagnostics-capture-max-files', '诊断文件数', 'number', '诊断捕获文件最大保留数'),
    F('diagnostics-capture-max-file-size', '诊断文件大小', 'number', '诊断捕获文件大小上限（字节，默认 2MB=2097152）'),

    // ── 杂项 ──
    F('emit-server-telemetry', '遥测数据', 'boolean', '向 Mojang 发送匿名遥测数据', BOOL),
    F('language', '语言', 'string', '服务器语言（如 zh_CN, en_US）'),
    F('allow-player-joining', '允许加入', 'boolean', '允许玩家加入；设为 false 时仅脚本可控制加入', BOOL),

    F('sentry-rate-limit-window', 'Sentry 限速窗口', 'number', 'Sentry 错误上报限速窗口（秒，0=不限）'),
    F('sentry-max-events-per-window', 'Sentry 最大事件数', 'number', 'Sentry 窗口内最大事件数（0=禁用上报）'),
    F('enable-profiler', '性能分析器', 'boolean', '启用性能分析器支持', BOOL),
    F('enable-editor-network-metrics', '网络指标收集', 'boolean', '启用网络指标收集（调试器实时诊断）', BOOL),
    F('script-debugger-passcode', '调试器密码', 'string', '调试器连接密码（VS Code 会提示输入）'),
  ],
};

export { PROP_SCHEMA };
