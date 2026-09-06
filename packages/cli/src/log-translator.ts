/**
 * log-translator.ts — BDS 原版日志本地化翻译与友好转换引擎
 *
 * 将 Minecraft 基岩版专用服务端 (BDS) 引擎输出的晦涩英文日志
 * （如 Beta APIs 阻断、方块形态超限、包缺失、配方失效、语法错误等）
 * 转换为服主与开发者易懂的本地化语言日志。
 */

export interface TranslationRule {
  id: string;
  pattern: RegExp;
  translations: {
    "zh-CN": string;
    [locale: string]: string;
  };
}

/**
 * 内置常见 BDS 原版日志翻译字典
 */
export const BUILTIN_BDS_TRANSLATIONS: TranslationRule[] = [
  // 1. 实验性 / 测试版 API 未开启导致脚本阻断加载
  {
    id: "beta-apis-missing",
    pattern: /(?:Plugin|Script)\s+\[(.+?)\]\s*-\s*requesting dependency on beta APIs\s*\[(.+?)\],\s*but the Beta APIs experiment is not enabled\./i,
    translations: {
      "zh-CN": "[脚本阻断] 插件「$1」依赖测试版 API ($2)，但当前世界未开启「测试版 API (Beta APIs)」实验开关，已被 BDS 拒绝运行。请在世界配置中开启该实验开关。",
    },
  },
  // 2. 脚本语法错误 / 符号缺失
  {
    id: "script-syntax-missing-export",
    pattern: /SyntaxError:\s*Could not find export '(.+?)' in module '(.+?)'/i,
    translations: {
      "zh-CN": "[脚本语法错误] 模组尝试从「$2」导入不存在的符号「$1」，脚本加载失败。请检查模组脚本语法或 API 版本兼容性。",
    },
  },
  // 3. 世界配置清单中的包在磁盘上不存在
  {
    id: "configured-pack-missing",
    pattern: /Configured pack \(id:\s*([0-9a-fA-F-]+),\s*version:\s*([^)]+)\)\s*was not found and was ignored/i,
    translations: {
      "zh-CN": "[包缺失] 世界激活清单中的包 (UUID: $1, 版本: $2) 在本地未找到，已被 BDS 自动忽略。",
    },
  },
  // 4. 自定义方块形态数量超限警告
  {
    id: "block-permutations-limit",
    pattern: /World with over 65536 block permutations may degrade performance\.\s*Current world has (\d+) permutations\./i,
    translations: {
      "zh-CN": "[性能提示] 自定义方块形态数量达 $1 个 (超出推荐上限 65,536)，可能影响服务端及客户端加载性能。",
    },
  },
  // 5. 配方物品不存在或无效
  {
    id: "recipe-item-missing",
    pattern: /(?:\[Recipes\]\s+)?(.+?)\s+\|\s+(.+?)\s+\|\s+The Item:\s*(\S+)\s+is missing or invalid,\s*can't make the recipe/i,
    translations: {
      "zh-CN": "[配方错误] 配方文件「$1」(配方标识: $2) 引用的物品「$3」不存在或无效，无法生成合成配方。",
    },
  },
  // 6. 配方缺少有效原料
  {
    id: "recipe-ingredient-missing",
    pattern: /(?:\[Recipes\]\s+)?(.+?)\s+\|\s+(.+?)\s+\|\s+Recipe for:\s*(\S+)\s+is missing \(unknown\) ingredient/i,
    translations: {
      "zh-CN": "[配方错误] 配方文件「$1」(产物: $2) 缺少有效原料（包含未识别的原料），无法注册。",
    },
  },
  // 7. 配方产物格式错误
  {
    id: "recipe-result-malformed",
    pattern: /(?:\[Recipes\]\s+)?(.+?)\s+\|\s+(.+?)\s+\|\s+Recipe result malformed/i,
    translations: {
      "zh-CN": "[配方错误] 配方文件「$1」(配方标识: $2) 的产物结果定义格式错误 (Malformed result)。",
    },
  },
  // 8. 方块定义组件未在 Schema 中声明
  {
    id: "block-component-schema-unknown",
    pattern: /(?:\[Blocks\]\s+)?block_definitions\s*\|.*?\|\s*([^|\r\n]+?)\.json\s*\|\s*(?:->\s*)?(.+?):\s*this component was found in the input,\s*but is not present in the Schema/i,
    translations: {
      "zh-CN": "[方块规范错误] 方块定义「$1.json」包含未在当前版本 Schema 中定义的未知组件: $2",
    },
  },
  // 9. 方块组件子项在此处无效
  {
    id: "block-child-component-invalid",
    pattern: /(?:\[Blocks\]\s+)?block_definitions\s*\|.*?\|\s*([^|\r\n]+?)\.json\s*\|.*?\|\s*components\s*\|\s*([^|\r\n]+?)\s*\|\s*child '(.+?)' not valid here\./i,
    translations: {
      "zh-CN": "[方块配置错误] 方块定义「$1.json」组件「$2」的子属性「$3」在此处无效。",
    },
  },
  // 10. 方块定义解析失败
  {
    id: "block-definition-parse-failed",
    pattern: /(?:\[Blocks\]\s+)?block_definitions\s*\|.*?\|\s*([^|\r\n]+?)\.json\s*\|\s*Block definition parsing failed/i,
    translations: {
      "zh-CN": "[方块解析失败] 无法解析方块定义文件「$1.json」。",
    },
  },
  // 11. 脚本组件未在脚本中注册但被物品使用
  {
    id: "script-component-not-registered",
    pattern: /(?:\[Scripting\]\s+)?Component '(.+?)' was not registered in script but used on an item/i,
    translations: {
      "zh-CN": "[脚本组件未注册] 物品引用了未在脚本中注册的自定义组件「$1」。",
    },
  },
  // 12. 脚本注册的方块组件未被任何方块使用
  {
    id: "block-component-unused",
    pattern: /(?:\[Scripting\]\s+)?Block custom component '(.+?)' is not being used by a block/i,
    translations: {
      "zh-CN": "[组件提示] 脚本注册的方块自定义组件「$1」未被任何方块使用。",
    },
  },
  // 13. 脚本注册的物品组件未被任何物品使用
  {
    id: "item-component-unused",
    pattern: /(?:\[Scripting\]\s+)?Item custom component '(.+?)' is not being used by an item/i,
    translations: {
      "zh-CN": "[组件提示] 脚本注册的物品自定义组件「$1」未被任何物品使用。",
    },
  },
  // 14. 服务端启动就绪
  {
    id: "server-started",
    pattern: /^Server started\./i,
    translations: {
      "zh-CN": "[服务端] BDS 服务端已成功启动，准备就绪。",
    },
  },
  // 15. 服务端停机流程
  {
    id: "server-stop-requested",
    pattern: /^Server stop requested\./i,
    translations: {
      "zh-CN": "[服务端] 收到停服请求，正在通知并保存世界数据...",
    },
  },
  {
    id: "server-stopping",
    pattern: /^Stopping server\.\.\./i,
    translations: {
      "zh-CN": "[服务端] 正在关闭服务端...",
    },
  },
  {
    id: "server-quit-correctly",
    pattern: /^Quit correctly/i,
    translations: {
      "zh-CN": "[服务端] 服务端已正常安全退出。",
    },
  },
  {
    id: "server-starting",
    pattern: /^Starting Server/i,
    translations: {
      "zh-CN": "[服务端] 正在启动 BDS 服务端...",
    },
  },
  {
    id: "server-setting-up-logging",
    pattern: /^NO LOG FILE! - setting up server logging\.\.\./i,
    translations: {
      "zh-CN": "[服务端] 正在初始化服务端日志系统...",
    },
  },
  // 16. 打开世界数据
  {
    id: "opening-level",
    pattern: /^Opening level '(.+?)'/i,
    translations: {
      "zh-CN": "[世界] 正在打开世界数据: $1",
    },
  },
  // 17. 网络端口与信令服务
  {
    id: "ipv4-port",
    pattern: /^IPv4 supported, port: (\d+): Used for gameplay and LAN discovery/i,
    translations: {
      "zh-CN": "[网络] IPv4 游戏与局域网发现端口: $1 (UDP)",
    },
  },
  {
    id: "ipv6-port",
    pattern: /^IPv6 supported, port: (\d+): Used for gameplay/i,
    translations: {
      "zh-CN": "[网络] IPv6 游戏端口: $1 (UDP)",
    },
  },
  {
    id: "signaling-signed-in",
    pattern: /^Signed in to signaling service successfully/i,
    translations: {
      "zh-CN": "[网络] 已成功登录微软联机信令服务。",
    },
  },
  {
    id: "waiting-minecraft-services",
    pattern: /^Waiting for Minecraft services\.\.\./i,
    translations: {
      "zh-CN": "[服务端] 正在等待 Minecraft 基础服务连接...",
    },
  },
  // 18. 白名单警告与提示
  {
    id: "allowlist-empty-warning",
    pattern: /^Allow list is enabled but contains no entries\./i,
    translations: {
      "zh-CN": "[白名单警告] 白名单功能已开启但名单为空！除管理员外其他玩家将无法加入服务器。",
    },
  },
  {
    id: "allowlist-add-hint",
    pattern: /^Use allowlist add <playername> for you and your friends so that they can access the server, or modify allowlist\.json manually\./i,
    translations: {
      "zh-CN": "[白名单提示] 请使用「allowlist add <玩家名>」添加允许进入的玩家，或手动编辑 allowlist.json。",
    },
  },
  {
    id: "allowlist-toggle-hint",
    pattern: /^Alternatively, the allow list can be turned off by typing allowlist off or manually toggled in the server\.properties file\./i,
    translations: {
      "zh-CN": "[白名单提示] 可通过输入「allowlist off」或在 server.properties 中关闭白名单控制。",
    },
  },
  // 19. 控制台内容日志已禁用
  {
    id: "content-log-disabled",
    pattern: /^Content logging to console is disabled\.\s*Enable it with content-log-console-output-enabled=true in server\.properties/i,
    translations: {
      "zh-CN": "[提示] 模组内容日志输出至控制台当前已关闭（可通过 server.properties 中的 content-log-console-output-enabled=true 开启）。",
    },
  },
  // 20. 未知指令提示
  {
    id: "unknown-command",
    pattern: /^Unknown command:\s*(.+?)\.\s*Please check that the command exists and that you have permission to use it\./i,
    translations: {
      "zh-CN": "[指令错误] 未知指令「$1」。请检查指令是否存在或您是否具备执行权限。",
    },
  },
  // 21. 玩家连接与断开
  {
    id: "player-connected",
    pattern: /^Player connected:\s*([^,]+),\s*xuid:\s*(\S+)/i,
    translations: {
      "zh-CN": "[玩家连接] 玩家 $1 已加入世界 (XUID: $2)",
    },
  },
  {
    id: "player-disconnected",
    pattern: /^Player disconnected:\s*([^,]+),\s*xuid:\s*(\S+)/i,
    translations: {
      "zh-CN": "[玩家断开] 玩家 $1 已离开世界 (XUID: $2)",
    },
  },
];

/**
 * 将正则匹配结果套入含 $1, $2 等占位符的模板字符串
 */
export function interpolateRegexTemplate(match: RegExpMatchArray, template: string): string {
  return template.replace(/\$(\d+)/g, (full, indexStr: string) => {
    const idx = parseInt(indexStr, 10);
    if (!isNaN(idx) && idx < match.length) {
      return match[idx] ?? "";
    }
    return full;
  });
}

/**
 * 应用规则正则替换模板
 */
export function applyRuleReplacement(text: string, regex: RegExp, replaceTemplate: string): string {
  const m = text.match(regex);
  if (!m) return text;
  return interpolateRegexTemplate(m, replaceTemplate);
}

/**
 * 翻译单条 BDS 日志文本（纯函数）
 */
export function translateBdsLog(
  text: string,
  locale: string = "zh-CN"
): { translated: boolean; text: string; ruleId?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { translated: false, text };
  }

  // 仅在非英文（如 zh-CN）或配置了该语言时翻译
  const targetLocale = locale === "zh" ? "zh-CN" : locale;

  for (const rule of BUILTIN_BDS_TRANSLATIONS) {
    const m = trimmed.match(rule.pattern);
    if (m) {
      const template = rule.translations[targetLocale];
      if (template) {
        const translatedText = interpolateRegexTemplate(m, template);
        return { translated: true, text: translatedText, ruleId: rule.id };
      }
    }
  }

  return { translated: false, text };
}
