/**
 * command-surface.ts — sfmc CLI 命令通道注册表（单一权威）
 *
 * channel:
 *   - both: argv（`sfmc <cmd>`）与 REPL 均可用（默认）
 *   - repl: 仅 REPL；argv 拒绝（如 send / quit）
 *   - external: 已弃用；勿新增（历史兼容保留类型）
 *
 * accent: "dev" 仅影响帮助/补全蓝色样式，不参与 canRun（OCP/DRY）。
 * 业务实现不在本文件 / 面板内：分发到 commands、module-commands、world-packs 等。
 */
import { stdin } from "node:process";

export type CommandChannel = "external" | "repl" | "both";
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

export type CanRunFailReason = "externalOnly" | "replOnly" | "needTty";

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
 */
export const MODULE_TOP_SHORTHAND: Readonly<Record<string, string>> = {
  install: "install",
  uninstall: "uninstall",
  search: "search",
  verify: "verify",
  link: "link",
  create: "create",
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
  if (channel === "external") return mode === "argv";
  return mode === "repl";
}

/** 判定当前模式下能否执行该命令（accent 不参与）。 */
export function canRunCommand(spec: CommandSpec, ctx: CanRunContext): CanRunResult {
  if (!channelAllows(spec.channel, ctx.mode)) {
    return { ok: false, reason: spec.channel === "external" ? "externalOnly" : "replOnly" };
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
  /** 追加到命令行的 token（根节点含或不含前导逻辑由组装负责） */
  token: string;
  /** i18n 描述键 */
  descKey?: string;
  accent?: CommandAccent;
  /** 固定下一参选项；回车后在右侧展开 */
  children?: PaletteNode[];
  /** 无 children 时仍需自由输入（回车后填入空格继续打字） */
  freeArgs?: boolean;
};

/** @deprecated 兼容旧扁平条目；新逻辑用 PaletteNode */
export type PaletteEntry = {
  slash: string;
  needsArgs: boolean;
  accent?: CommandAccent;
  label: string;
  descKey: string;
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
  remote: "help.remote.status",
  debug: "help.debug.status",
  install: "help.module.install",
  uninstall: "help.module.uninstall",
  search: "help.module.search",
  verify: "help.module.verify",
  link: "help.module.link",
  create: "help.module.create",
  dev: "help.module.dev",
  watch: "help.module.watch",
  test: "help.module.test",
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
  create: "help.module.create",
  link: "help.module.link",
  dev: "help.module.dev",
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
  const noArg = new Set(["list", "build", "create", "dev"]);
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

function packsChildNodes(mode: CommandMode): PaletteNode[] {
  const noArg = new Set(["list", "doctor", "path", "sources"]);
  return listVisiblePacksSubs(mode).map((sub) => ({
    label: sub,
    token: sub,
    descKey: PACKS_DESC[sub] ?? "help.addon",
    freeArgs: !noArg.has(sub),
  }));
}

/** 层级命令树（REPL 面板主列） */
export function listPaletteRoots(mode: CommandMode = "repl"): PaletteNode[] {
  const specs = listVisibleCommands(mode);
  const out: PaletteNode[] = [];
  const seen = new Set<string>();

  for (const s of specs) {
    if (s.sub) continue;
    if (s.name === "module" || s.name === "packs") continue;
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

/** 扁平列表（测试 / 旧调用）；层级 UI 请用 listPaletteRoots */
export function listPaletteEntries(mode: CommandMode = "repl"): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  const walk = (nodes: PaletteNode[], prefix: string[]): void => {
    for (const n of nodes) {
      const path = [...prefix, n.token];
      const slash = "/" + path.join(" ");
      if (n.children?.length) {
        walk(n.children, path);
      } else {
        out.push({
          slash,
          needsArgs: Boolean(n.freeArgs),
          label: slash,
          descKey: n.descKey ?? "help.help",
          ...(n.accent ? { accent: n.accent } : {}),
        });
      }
    }
  };
  walk(listPaletteRoots(mode), []);
  return out;
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
  { id: "remote", name: "remote", channel: "both" },
  { id: "debug", name: "debug", channel: "both", accent: "dev" },

  /** 顶层扁平短命令 → module.*（少写一层 module） */
  { id: "install", name: "install", channel: "both" },
  { id: "uninstall", name: "uninstall", channel: "both", aliases: ["remove"] },
  { id: "search", name: "search", channel: "both" },
  { id: "verify", name: "verify", channel: "both" },
  { id: "link", name: "link", channel: "both" },
  { id: "create", name: "create", channel: "both", needsTty: true, accent: "dev" },

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
  { id: "module.link", name: "module", sub: "link", channel: "both" },
  {
    id: "module.create",
    name: "module",
    sub: "create",
    channel: "both",
    needsTty: true,
    accent: "dev",
  },
  {
    id: "module.dev",
    name: "module",
    sub: "dev",
    channel: "both",
    needsTty: true,
    accent: "dev",
  },

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
