/**
 * command-surface.ts — sfmc CLI 命令通道注册表（单一权威）
 *
 * channel:
 *   - both: argv（`sfmc <cmd>`）与 REPL 均可用（默认）
 *   - repl: 仅 REPL；argv 拒绝（如 send / quit）
 *
 * accent: "dev" 仅影响帮助/补全蓝色样式，不参与 canRun（OCP/DRY）。
 * 业务实现不在本文件 / 面板内：分发到 commands、module-commands、world-packs 等。
 */
import { stdin } from "node:process";
import { t } from "./i18n/index.js";

export type CommandChannel = "repl" | "both";
export type CommandMode = "argv" | "repl";
export type CommandAccent = "dev";

export type CommandSpec = {
  /** 稳定 id，如 "module.install" / "send" / "debug" */
  id: string;
  /** 顶层命令名（module 子命令用 "module"；顶层别名见 TOP_LEVEL_ALIASES） */
  name: string;
  /** 子命令（仅 module/packs 等） */
  sub?: string;
  channel: CommandChannel;
  needsTty?: boolean;
  /** 帮助染色；不参与 canRun */
  accent?: CommandAccent;
  /** 子命令同义别名（如 uninstall → remove），不是顶层别名 */
  aliases?: string[];
};

export type CanRunContext = {
  mode: CommandMode;
  isTty: boolean;
};

export type CanRunFailReason = "replOnly" | "needTty";

export type CanRunResult = { ok: true } | { ok: false; reason: CanRunFailReason };

/** 顶层命令别名 → 规范 name（DRY：勿在各 sub spec 重复写 mod/addon） */
export const TOP_LEVEL_ALIASES: Readonly<Record<string, string>> = {
  mod: "module",
  addon: "packs",
  log: "logs",
  lang: "locale",
  h: "help",
  "?": "help",
  exit: "quit",
  q: "quit",
  i: "install",
  remove: "uninstall",
};

/**
 * 顶层扁平短命令 → module 子命令（argv / REPL 共用，避免在 switch 里散落映射）
 * 不含 enable/disable（与 packs 冲突，仍走 /module 或 /packs）
 *
 * 与 packs 子命令对齐：`packs i` → `packs install`（mapPacksSubAlias）；
 * module 顶层同样支持 `i` → `install`（见 TOP_LEVEL_ALIASES 与本表）。
 */
export const MODULE_TOP_SHORTHAND: Readonly<Record<string, string>> = {
  i: "install",
  install: "install",
  uninstall: "uninstall",
  search: "search",
  verify: "verify",
};

export function resolveModuleTopShorthand(cmd: string | undefined): string | undefined {
  if (!cmd) return undefined;
  const name = resolveTopLevelName(cmd);
  if (!name) return undefined;
  return MODULE_TOP_SHORTHAND[name];
}

export function resolveTopLevelName(cmd: string | undefined): string | undefined {
  if (!cmd) return undefined;
  return TOP_LEVEL_ALIASES[cmd] ?? cmd;
}

function channelAllows(channel: CommandChannel, mode: CommandMode): boolean {
  if (channel === "both") return true;
  return mode === "repl";
}

/** 判定当前模式下能否执行该命令（accent 不参与）。 */
export function canRunCommand(spec: CommandSpec, ctx: CanRunContext): CanRunResult {
  if (!channelAllows(spec.channel, ctx.mode)) {
    return { ok: false, reason: "replOnly" };
  }
  if (spec.needsTty && !ctx.isTty) {
    return { ok: false, reason: "needTty" };
  }
  return { ok: true };
}

/** 当前模式可见命令（help / Tab）。 */
export function listVisibleCommands(mode: CommandMode): CommandSpec[] {
  return COMMAND_SPECS.filter((s) => channelAllows(s.channel, mode));
}

/** 顶层命令名（含别名），供 REPL COMMANDS / 补全。 */
export function listVisibleTopLevelNames(mode: CommandMode): string[] {
  const canonical = new Set<string>();
  for (const s of listVisibleCommands(mode)) {
    canonical.add(s.name);
  }
  const out = new Set<string>(canonical);
  for (const [alias, name] of Object.entries(TOP_LEVEL_ALIASES)) {
    if (canonical.has(name)) out.add(alias);
  }
  return [...out];
}

/** 查找顶层命令（无 sub）的任意一条同名 spec（用于 channel 门禁）。 */
export function findTopLevelSpec(cmd: string | undefined): CommandSpec | undefined {
  const name = resolveTopLevelName(cmd);
  if (!name) return undefined;
  /* 优先无 sub 的顶层条目；否则取该 name 下任意可见 spec 代表通道（module/packs） */
  const top = COMMAND_SPECS.find((s) => !s.sub && s.name === name);
  if (top) return top;
  return COMMAND_SPECS.find((s) => s.name === name);
}

/** 查找 module 子命令 spec。 */
export function findModuleSubSpec(sub: string | undefined): CommandSpec | undefined {
  if (!sub) return undefined;
  return COMMAND_SPECS.find(
    (s) => s.name === "module" && (s.sub === sub || (s.aliases ?? []).includes(sub))
  );
}

/** 查找 packs 子命令 spec。 */
export function findPacksSubSpec(sub: string | undefined): CommandSpec | undefined {
  if (!sub) return undefined;
  return COMMAND_SPECS.find(
    (s) => s.name === "packs" && (s.sub === sub || (s.aliases ?? []).includes(sub))
  );
}

/** 当前 mode 下可见的 module 子命令名（规范名，不含 remove 别名）。 */
export function listVisibleModuleSubs(mode: CommandMode): string[] {
  return listVisibleCommands(mode)
    .filter((s) => s.name === "module" && s.sub)
    .map((s) => s.sub!);
}

/** 当前 mode 下可见的 packs 子命令名。 */
export function listVisiblePacksSubs(mode: CommandMode): string[] {
  return listVisibleCommands(mode)
    .filter((s) => s.name === "packs" && s.sub)
    .map((s) => s.sub!);
}

/** REPL 快速补全：层级节点（主面板 → 右侧子面板） */
export type PaletteNode = {
  /** 面板内显示的标签 */
  label: string;
  /**
   * 追加到命令行的 token。
   * 空字符串表示「直接运行」：不追加参数，回车提交已经写好的父命令。
   */
  token: string;
  /** i18n 描述键 */
  descKey?: string;
  accent?: CommandAccent;
  /** 固定下一参选项；回车后在右侧展开 */
  children?: PaletteNode[];
  /**
   * 无 children 时仍需自由输入（回车后填入空格继续打字）。
   * token 以 `=` 结尾时不补空格，后续字符粘在同一 token 上（如 `--experiments=beta,upcoming`）。
   */
  freeArgs?: boolean;
};

const NO_ARG_TOP = new Set(["status", "help", "version", "quit", "init", "logs"]);

const TOP_DESC: Record<string, string> = {
  status: "help.status",
  logs: "help.logs",
  start: "help.start",
  stop: "help.stop",
  restart: "help.restart",
  send: "help.send",
  help: "help.help",
  version: "help.version",
  quit: "help.quit",
  init: "help.init",
  update: "help.update",
  locale: "help.locale",
  debug: "help.debug.status",
  ui: "help.ui",
  daemon: "help.daemon",
  install: "help.module.install",
  uninstall: "help.module.uninstall",
  search: "help.module.search",
  verify: "help.module.verify",
};

const MODULE_DESC: Record<string, string> = {
  list: "help.module.list",
  info: "help.module.info",
  build: "help.module.build",
  reload: "help.module.reload",
  search: "help.module.search",
  install: "help.module.install",
  uninstall: "help.module.uninstall",
  verify: "help.module.verify",
  enable: "help.module.toggle",
  disable: "help.module.toggle",
  update: "help.module.update",
  pin: "help.module.pin",
};

const PACKS_DESC: Record<string, string> = {
  list: "help.packs.list",
  search: "help.packs.search",
  enable: "help.packs.enable",
  disable: "help.packs.disable",
  doctor: "help.packs.doctor",
  path: "help.packs.path",
  install: "help.addon",
  scan: "help.addon",
  uninstall: "help.addon",
  bind: "help.addon",
  unbind: "help.addon",
  sources: "help.addon",
  check: "help.addon",
  update: "help.addon",
  bump: "help.addon",
};

function serviceArgNodes(): PaletteNode[] {
  return [
    { label: "-all", token: "-all" },
    ...(["bds", "db", "qq", "llbot"] as const).map((n) => ({ label: n, token: n })),
  ];
}

function moduleChildNodes(mode: CommandMode): PaletteNode[] {
  const noArg = new Set(["list", "build"]);
  return listVisibleModuleSubs(mode).map((sub) => {
    const spec = findModuleSubSpec(sub);
    const node: PaletteNode = {
      label: sub,
      token: sub,
      descKey: MODULE_DESC[sub] ?? "help.module.list",
      freeArgs: !noArg.has(sub),
    };
    if (spec?.accent) node.accent = spec.accent;
    return node;
  });
}

/**
 * 「直接运行」项：token 为空，回车提交已经写好的父命令。
 * 用在无参本身就是合法命令、同时还要展开可选开关的节点上。
 */
function asIsNode(descKey: string, labelKey: "palette.asIs" | "palette.fixOnly" | "palette.localeCurrent" = "palette.asIs"): PaletteNode {
  return { label: t(labelKey), token: "", descKey };
}

/** `/ui` 的固定子命令（studio 启动编辑器，stop 停掉当前进程内的服务）。 */
function uiChildNodes(): PaletteNode[] {
  return [
    { label: "studio", token: "studio", descKey: "help.ui.studio" },
    { label: "stop", token: "stop", descKey: "help.ui.stop" },
  ];
}

/** `/debug` 的固定子命令；sentry on 之后还要粘上 `--dsn=`。 */
function debugChildNodes(): PaletteNode[] {
  return [
    { label: "status", token: "status", descKey: "help.debug.status" },
    { label: "enable", token: "enable", descKey: "help.debug.toggle" },
    { label: "disable", token: "disable", descKey: "help.debug.toggle" },
    {
      label: "sentry",
      token: "sentry",
      descKey: "help.debug.sentry",
      children: [
        {
          label: "on",
          token: "on",
          descKey: "help.debug.sentry.on",
          children: [{ label: "--dsn=", token: "--dsn=", descKey: "help.debug.sentry.on", freeArgs: true }],
        },
        { label: "off", token: "off", descKey: "help.debug.sentry.off" },
      ],
    },
  ];
}

/** `/daemon` 的固定子命令。无参等价于 status，面板里仍单列出来。 */
function daemonChildNodes(): PaletteNode[] {
  return [
    { label: "status", token: "status", descKey: "help.daemon.status" },
    { label: "stop", token: "stop", descKey: "help.daemon.stop" },
  ];
}

/** `/locale` 的可选语言；第一项不带参数，只打印当前语言。 */
function localeChildNodes(): PaletteNode[] {
  return [
    asIsNode("help.locale", "palette.localeCurrent"),
    { label: "zh-CN", token: "zh-CN", descKey: "locale.opt.zh" },
    { label: "en", token: "en", descKey: "locale.opt.en" },
  ];
}

/** `/update` 的已知开关。无参就是检查并更新。 */
function updateChildNodes(): PaletteNode[] {
  return [
    asIsNode("help.update"),
    { label: "--check-only", token: "--check-only", descKey: "help.update.checkOnly" },
    { label: "--force", token: "--force", descKey: "help.update.force" },
    { label: "--no-start", token: "--no-start", descKey: "help.update.noStart" },
    { label: "--channel=release", token: "--channel=release", descKey: "help.update.channelRelease" },
    { label: "--channel=preview", token: "--channel=preview", descKey: "help.update.channelPreview" },
  ];
}

/**
 * `packs doctor` 的开关。
 * 无参只诊断；`--experiments=` 后面的别名粘在同一个 token 上。
 */
function doctorNode(): PaletteNode {
  const experimentList: PaletteNode = {
    label: "--experiments=",
    token: "--experiments=",
    descKey: "help.packs.doctor.experimentsList",
    freeArgs: true,
  };
  const allExperiments: PaletteNode = {
    label: "--all-experiments",
    token: "--all-experiments",
    descKey: "help.packs.doctor.allExperiments",
  };
  return {
    label: "doctor",
    token: "doctor",
    descKey: "help.packs.doctor",
    children: [
      asIsNode("help.packs.doctor"),
      {
        label: "--fix",
        token: "--fix",
        descKey: "help.packs.doctor.fix",
        children: [asIsNode("help.packs.doctor.fix", "palette.fixOnly"), allExperiments, experimentList],
      },
      allExperiments,
      { label: "--experiments", token: "--experiments", descKey: "help.packs.doctor.experiments" },
      experimentList,
    ],
  };
}

function packsChildNodes(mode: CommandMode): PaletteNode[] {
  const noArg = new Set(["list", "path", "sources"]);
  return listVisiblePacksSubs(mode).map((sub) => {
    if (sub === "doctor") return doctorNode();
    return {
      label: sub,
      token: sub,
      descKey: PACKS_DESC[sub] ?? "help.addon",
      freeArgs: !noArg.has(sub),
    };
  });
}

/** 层级命令树（REPL 面板主列） */
export function listPaletteRoots(mode: CommandMode = "repl"): PaletteNode[] {
  const specs = listVisibleCommands(mode);
  const out: PaletteNode[] = [];
  const seen = new Set<string>();
  /** 面板不展示顶层短命令，统一走 /module <sub>（argv 短命令仍可用） */
  const skipTopShorthand = new Set(Object.keys(MODULE_TOP_SHORTHAND));

  for (const s of specs) {
    if (s.sub) continue;
    if (s.name === "module" || s.name === "packs") continue;
    if (skipTopShorthand.has(s.name)) continue;
    if (seen.has(s.name)) continue;
    seen.add(s.name);

    const node: PaletteNode = {
      label: `/${s.name}`,
      token: s.name,
      descKey: TOP_DESC[s.name] ?? "help.help",
    };
    if (s.accent) node.accent = s.accent;

    if (s.name === "start" || s.name === "stop" || s.name === "restart") {
      node.children = serviceArgNodes();
    } else if (s.name === "send") {
      node.children = (["bds", "db", "qq", "llbot"] as const).map((n) => ({
        label: n,
        token: n,
        freeArgs: true,
      }));
    } else if (s.name === "ui") {
      node.children = uiChildNodes();
    } else if (s.name === "debug") {
      node.children = debugChildNodes();
    } else if (s.name === "daemon") {
      node.children = daemonChildNodes();
    } else if (s.name === "locale") {
      node.children = localeChildNodes();
    } else if (s.name === "update") {
      node.children = updateChildNodes();
    } else if (!NO_ARG_TOP.has(s.name)) {
      node.freeArgs = true;
    }

    out.push(node);
  }

  const moduleSubs = moduleChildNodes(mode);
  if (moduleSubs.length > 0) {
    out.push({
      label: "/module",
      token: "module",
      descKey: "help.module.list",
      children: moduleSubs,
    });
  }

  const packsSubs = packsChildNodes(mode);
  if (packsSubs.length > 0) {
    out.push({
      label: "/packs",
      token: "packs",
      descKey: "help.addon",
      children: packsSubs,
    });
  }

  return out;
}

/**
 * 已提交路径的下一参 token，供非 `/` 灰字补全与面板共用同一棵树。
 * 没有对应节点时返回 null；节点存在但没有子项时返回空数组。
 * 「直接运行」的空 token 不出现在补全里。
 */
export function listNextPaletteTokens(path: readonly string[], mode: CommandMode = "repl"): string[] | null {
  if (path.length === 0) return null;
  let current: PaletteNode | undefined = listPaletteRoots(mode).find((n) => n.token === path[0]);
  if (!current) return null;
  for (let i = 1; i < path.length; i++) {
    const token = path[i] ?? "";
    const children: readonly PaletteNode[] = current.children ?? [];
    current = children.find((child) => child.token === token);
    if (!current) return null;
  }
  const kids = current.children;
  if (!kids?.length) return [];
  return kids.map((child) => child.token).filter((token) => token.length > 0);
}

export function isDevAccent(spec: CommandSpec | undefined): boolean {
  return spec?.accent === "dev";
}

/** sub 是否为开发者样式命令（蓝标）。 */
export function isDevAccentModuleSub(sub: string | undefined): boolean {
  return isDevAccent(findModuleSubSpec(sub));
}

/** stdin TTY 探测（供 main/repl 共用）。 */
export function isCliTty(): boolean {
  return Boolean(stdin.isTTY);
}

/**
 * 命令注册表 —— 新增命令只加此处（OCP）。
 * channel:
 *   - both: argv + REPL（默认；面板只调度既有 dispatcher）
 *   - repl: 仅 REPL（如 send / quit）
 */
export const COMMAND_SPECS: readonly CommandSpec[] = [
  /* ─── both：服务 / 模块 / 资源包 / 配置 ─── */
  { id: "status", name: "status", channel: "both" },
  { id: "start", name: "start", channel: "both" },
  { id: "stop", name: "stop", channel: "both" },
  { id: "restart", name: "restart", channel: "both" },
  { id: "logs", name: "logs", channel: "repl" },
  { id: "help", name: "help", channel: "both" },
  { id: "version", name: "version", channel: "both" },
  { id: "init", name: "init", channel: "both", needsTty: true },
  { id: "update", name: "update", channel: "both" },
  { id: "locale", name: "locale", channel: "both" },
  { id: "daemon", name: "daemon", channel: "both" },
  { id: "debug", name: "debug", channel: "both", accent: "dev" },
  { id: "ui", name: "ui", channel: "both", accent: "dev" },

  /** 顶层扁平短命令 → module.*（少写一层 module） */
  { id: "install", name: "install", channel: "both" },
  { id: "uninstall", name: "uninstall", channel: "both", aliases: ["remove"] },
  { id: "search", name: "search", channel: "both" },
  { id: "verify", name: "verify", channel: "both" },

  { id: "module.list", name: "module", sub: "list", channel: "both" },
  { id: "module.info", name: "module", sub: "info", channel: "both" },
  { id: "module.build", name: "module", sub: "build", channel: "both", accent: "dev" },
  { id: "module.reload", name: "module", sub: "reload", channel: "both", accent: "dev" },
  { id: "module.install", name: "module", sub: "install", channel: "both" },
  {
    id: "module.uninstall",
    name: "module",
    sub: "uninstall",
    channel: "both",
    aliases: ["remove"],
  },
  { id: "module.search", name: "module", sub: "search", channel: "both" },
  { id: "module.verify", name: "module", sub: "verify", channel: "both" },
  { id: "module.enable", name: "module", sub: "enable", channel: "both" },
  { id: "module.disable", name: "module", sub: "disable", channel: "both" },
  { id: "module.update", name: "module", sub: "update", channel: "both" },
  { id: "module.pin", name: "module", sub: "pin", channel: "both" },

  { id: "packs.list", name: "packs", sub: "list", channel: "both" },
  { id: "packs.search", name: "packs", sub: "search", channel: "both" },
  { id: "packs.enable", name: "packs", sub: "enable", channel: "both" },
  { id: "packs.disable", name: "packs", sub: "disable", channel: "both" },
  { id: "packs.doctor", name: "packs", sub: "doctor", channel: "both" },
  { id: "packs.path", name: "packs", sub: "path", channel: "both" },
  { id: "packs.install", name: "packs", sub: "install", channel: "both" },
  { id: "packs.scan", name: "packs", sub: "scan", channel: "both" },
  { id: "packs.uninstall", name: "packs", sub: "uninstall", channel: "both" },
  { id: "packs.bind", name: "packs", sub: "bind", channel: "both" },
  { id: "packs.unbind", name: "packs", sub: "unbind", channel: "both" },
  { id: "packs.sources", name: "packs", sub: "sources", channel: "both" },
  { id: "packs.check", name: "packs", sub: "check", channel: "both" },
  { id: "packs.update", name: "packs", sub: "update", channel: "both" },
  { id: "packs.bump", name: "packs", sub: "bump", channel: "both" },

  /* ─── repl-only ─── */
  { id: "send", name: "send", channel: "repl" },
  { id: "quit", name: "quit", channel: "repl" },
];
