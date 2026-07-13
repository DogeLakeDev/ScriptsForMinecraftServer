/**
 * config-schema.js — 配置文件友好名称/类型定义
 * 用于 cfg_edit 视图的选项式编辑
 */

const ENUMS = {
  channel: [
    { label: '正式版', value: 'release' },
    { label: '预览版', value: 'preview' },
  ],
  dimension: [
    { label: '主世界', value: 'minecraft:overworld' },
    { label: '下界', value: 'minecraft:nether' },
    { label: '末地', value: 'minecraft:the_end' },
  ],
  moduleType: [
    { label: '飞行', value: 'fly' },
    { label: '创造', value: 'creative' },
    { label: '生存', value: 'survival' },
    { label: '和平', value: 'peace' },
  ],
};

const SCHEMA = {
  'bds_updater.json': {
    name: 'BDS 自动更新器',
    desc: 'BDS 版本检查/下载/备份/重启',
    fields: [
      { key: 'bds_path', label: 'BDS 安装路径', type: 'string' },
      { key: 'channel', label: '更新通道', type: 'enum', values: ENUMS.channel },
      { key: 'backup_dir', label: '备份目录', type: 'string' },
      { key: 'auto_restart', label: '更新后自动重启', type: 'boolean' },
      { key: 'qq_notify', label: 'QQ 更新通知', type: 'boolean' },
      { key: 'crash_restart', label: '崩溃后自动重启', type: 'boolean' },
      { key: 'crash_restart_delay', label: '崩溃重启延迟(秒)', type: 'number' },
      { key: 'scheduled_restart', label: '定时重启时间(留空=关闭)', type: 'string' },
      { key: 'scheduled_restart_announce', label: '重启前预告(秒)', type: 'number' },
      { key: 'auto_check', label: '自动检查更新', type: 'boolean' },
      { key: 'auto_check_interval', label: '检查间隔(分钟)', type: 'number' },
      { key: 'auto_update', label: '自动更新', type: 'boolean' },
      { key: 'auto_update_time', label: '自动更新时间', type: 'string' },
      { key: 'download_timeout', label: '下载超时(秒)', type: 'number' },
      { key: 'download_mirror', label: '下载镜像(留空=官方)(支持变量{version} {ver3} {platform} {channel})', type: 'string' },
      { key: 'preserve', label: '保留文件/目录(逗号分隔)', type: 'string', arrayJoin: true },
      { key: 'qq_config', label: 'QQ 配置路径', type: 'string' },
      { key: 'version_mode', label: '版本源', type: 'enum', values: [
        { label: 'Bedrock-OSS', value: 'bedrock-oss' },
        { label: 'Endstone', value: 'endstone' },
      ] },
      { key: 'version_versions', label: '版本列表 URL', type: 'string' },
      { key: 'version_versions_mirror', label: '版本列表镜像 URL', type: 'string' },
      { key: 'version_details', label: '版本详情 URL', type: 'string' },
      { key: 'version_details_mirror', label: '版本详情镜像 URL', type: 'string' },
    ],
  },

  'qq_config.json': {
    name: 'QQ 桥接配置',
    desc: 'OneBot 11 连接与消息格式',
    fields: [
      { key: 'qq_group_id', label: 'QQ 群号', type: 'number' },
      { key: 'bridge_channel_id', label: '桥接频道 ID', type: 'string' },
      { key: 'qq_ws_port', label: 'WebSocket 端口', type: 'number' },
      { key: 'qq_bridge_port', label: 'HTTP 端口', type: 'number' },
      { key: 'llbot_http', label: 'LLBot HTTP 地址', type: 'string' },
      { key: 'llbot_enabled', label: '启用 LLBot 管理', type: 'boolean' },
      { key: 'llbot_path', label: 'LLBot 路径', type: 'string' },
      { key: 'llbot_cwd', label: 'LLBot 工作目录', type: 'string' },
      { key: 'mctoqq_prefix', label: 'MC→QQ 消息前缀', type: 'string' },
      { key: 'db_host', label: '数据库主机', type: 'string' },
      { key: 'db_port', label: '数据库端口', type: 'number' },
    ],
  },

  'db_config.json': {
    name: 'DB Server 配置',
    desc: 'SQLite HTTP 后端服务',
    fields: [
      { key: 'db_port', label: 'HTTP 端口', type: 'number' }
    ],
  },

  'modules.json': {
    name: '功能模块开关（已弃用）',
    desc: '模块开关请通过面板「模块」Tab 或 /api/sfmc/modules/:id 修改，此文件保留以兼容旧版本',
    fields: [],
  },

  'settings.json': {
    name: '杂项设置',
    desc: 'AFK/问答/清理等通用参数',
    fields: [
      { key: 'afk_time', label: 'AFK 判定时间(秒)', type: 'number' },
      { key: 'qa_interval_min', label: '问答最小间隔(秒)', type: 'number' },
      { key: 'qa_interval_max', label: '问答最大间隔(秒)', type: 'number' },
      { key: 'qa_timeout', label: '问答超时(秒)', type: 'number' },
      { key: 'clean_item_max', label: '掉落物最大堆积数', type: 'number' },
      { key: 'clean_poll_interval', label: '清理轮询间隔(秒)', type: 'number' },
    ],
  },

  'clean.json': {
    name: '掉落物清理',
    desc: '清理线程参数',
    fields: [
      { key: 'item_max', label: '物品最大堆积数', type: 'number' },
      { key: 'poll_interval', label: '清理间隔(秒)', type: 'number' },
    ],
  },

  'areas.json': {
    name: '功能区域',
    desc: '飞行/创造/和平等功能的2D范围',
    type: 'array',
    itemLabel: (item) => `${item.module}: ${item.name || item.module}`,
    newItem: { module: 'fly', name: '', dimension: 'minecraft:overworld', start_x: 0, start_z: 0, end_x: 0, end_z: 0 },
    itemFields: [
      { key: 'module', label: '模块类型', type: 'enum', values: ENUMS.moduleType },
      { key: 'name', label: '区域名称', type: 'string' },
      { key: 'dimension', label: '维度', type: 'enum', values: ENUMS.dimension },
      { key: 'start_x', label: '起点 X', type: 'number' },
      { key: 'start_z', label: '起点 Z', type: 'number' },
      { key: 'end_x', label: '终点 X', type: 'number' },
      { key: 'end_z', label: '终点 Z', type: 'number' },
    ],
  },

  'permissions.json': {
    name: '玩家权限',
    desc: 'OP 与管理员列表',
    type: 'array',
    itemLabel: (item) => `${item.player_name} (等级${item.level})`,
    newItem: { player_name: '', level: 1 },
    itemFields: [
      { key: 'player_name', label: '玩家名', type: 'string' },
      { key: 'level', label: '权限等级', type: 'enum', values: [
        { label: '访客 0', value: 0 },
        { label: '成员 1', value: 1 },
        { label: '管理员 2', value: 2 },
        { label: '脚本定义管理员 3', value: 3 },
      ]},
    ],
  },

  'banned_items.json': {
    name: '禁用物品',
    desc: '用于在“创造区域”下禁止玩家使用的方块/物品',
    type: 'array',
    itemType: 'string',
    itemLabel: (item) => item,
    newItem: '',
    itemFields: [
      { key: '', label: '物品 ID', type: 'string' },
    ],
  },

  'peace_filters.json': {
    name: '和平保留生物',
    desc: '和平模式下例外的生物族群',
    type: 'array',
    itemLabel: (item) => `${item.family} (排除: ${item.exclude_family || '无'})`,
    newItem: { family: '', exclude_family: '' },
    itemFields: [
      { key: 'family', label: '生物族群', type: 'string' },
      { key: 'exclude_family', label: '排除族群(留空=全部)', type: 'string' },
    ],
  },

  'questions.json': {
    name: 'QA 题库',
    desc: '问答系统题目与奖励',
    type: 'array',
    itemLabel: (item) => item.question.slice(0, 25) + (item.question.length > 25 ? '…' : ''),
    newItem: { weight: 1, question: '', answers: [''], msg_right: '', msg_wrong: '', explanation: '', rewards: [{ type: 'money', amount: 100 }] },
    itemFields: [
      { key: 'weight', label: '权重', type: 'number' },
      { key: 'question', label: '问题', type: 'string' },
      { key: 'answers', label: '答案(逗号分隔)', type: 'string', arrayJoin: true },
      { key: 'msg_right', label: '答对消息(留空=默认)', type: 'string' },
      { key: 'msg_wrong', label: '答错消息(留空=默认)', type: 'string' },
      { key: 'explanation', label: '解析(留空=无)', type: 'string' },
    ],
  },

  'grids.json': {
    name: '容器网格',
    desc: '回收站/商店/物品栏箱子坐标',
    type: 'array',
    itemLabel: (item) => `${item.name} (${item.start_x},${item.start_z})`,
    newItem: { name: '', start_x: 0, start_y: 0, start_z: 0, size_h: 5, size_v: 5, direction: -1, face: -1 },
    itemFields: [
      { key: 'name', label: '容器名称', type: 'string' },
      { key: 'start_x', label: '起点 X', type: 'number' },
      { key: 'start_y', label: '起点 Y', type: 'number' },
      { key: 'start_z', label: '起点 Z', type: 'number' },
      { key: 'size_h', label: '横向格子数', type: 'number' },
      { key: 'size_v', label: '纵向格子数', type: 'number' },
      { key: 'direction', label: '朝向', type: 'number' },
      { key: 'face', label: '面', type: 'number' },
    ],
  },
  'panel_config.json': {
    name: '面板设置',
    desc: '面板自身配置（数据库查看模式等）',
    fields: [
      { key: 'db_view_mode', label: '数据查看模式', type: 'enum', values: [
        { label: 'HTTP (通过 db-server)', value: 'http' },
        { label: '直连 (better-sqlite3)', value: 'direct' },
      ]},
      { key: 'db_path', label: 'DB 路径(直连模式,留空=自动)', type: 'string' },
    ],
  },
};

export { SCHEMA, ENUMS };
