/**
 * help-text.ts — argv / REPL 帮助文案（按 command-surface 通道过滤）
 */
import {
  getVisibleModuleSubcommands,
  isDeveloperSubcommand,
} from "./module-commands.js";
import { listVisiblePacksSubs, listVisibleTopLevelNames, type CommandMode } from "./command-surface.js";
import { t } from "./i18n/index.js";
import { c, padRight } from "./theme.js";

const MODULE_HELP_ENTRIES: ReadonlyArray<{ sub: string; suffix: string; key: string }> = [
  { sub: "list", suffix: "", key: "help.module.list" },
  { sub: "search", suffix: " [id]", key: "help.module.search" },
  { sub: "install", suffix: " <id> [--from <source>] [--link]", key: "help.module.install" },
  { sub: "uninstall", suffix: " <id>", key: "help.module.uninstall" },
  { sub: "verify", suffix: " [id]", key: "help.module.verify" },
  { sub: "info", suffix: " <id>", key: "help.module.info" },
  { sub: "enable", suffix: "|disable <id>", key: "help.module.toggle" },
  { sub: "create", suffix: "", key: "help.module.create" },
  { sub: "link", suffix: " [id]", key: "help.module.link" },
  { sub: "dev", suffix: "", key: "help.module.dev" },
  { sub: "build", suffix: "", key: "help.module.build" },
  { sub: "reload", suffix: " [--build-only]", key: "help.module.reload" },
];

/** 命令列目标宽度（超出则说明换行） */
const HELP_CMD_COL = 36;

function hasTop(mode: CommandMode, name: string): boolean {
  return listVisibleTopLevelNames(mode).includes(name);
}

/** 单行「命令 + 说明」；命令过长则说明另起一行 */
function helpLine(cmdPainted: string, desc: string, col: number = HELP_CMD_COL): string {
  const plainLen = cmdPainted.replace(/\x1b\[[0-9;]*m/g, "").length;
  if (plainLen >= col) {
    return `  ${cmdPainted}\n    ${c.dim(desc)}`;
  }
  return `  ${padRight(cmdPainted, col)}${desc}`;
}

function moduleHelpBlock(mode: CommandMode): string {
  const visible = new Set(getVisibleModuleSubcommands(mode));
  const entries = MODULE_HELP_ENTRIES.filter(({ sub }) => visible.has(sub));
  return entries
    .map(({ sub, suffix, key }) => {
      const paint = isDeveloperSubcommand(sub) ? c.blue : c.green;
      const plain = mode === "argv" ? `sfmc module ${sub}${suffix}` : `/module ${sub}${suffix}`;
      return helpLine(paint(plain), t(key as never));
    })
    .join("\n");
}

function p(mode: CommandMode, cmd: string, paint: (s: string) => string = c.green): string {
  return mode === "argv" ? paint(`sfmc ${cmd}`) : paint(`/${cmd}`);
}

/** 带参数后缀的命令行 */
function pArgs(mode: CommandMode, cmd: string, args: string, paint: (s: string) => string = c.green): string {
  return mode === "argv" ? paint(`sfmc ${cmd}`) + args : paint(`/${cmd}`) + args;
}

export function getHelp(mode: CommandMode = "argv"): string {
  const show = (name: string) => hasTop(mode, name);
  const packsSubs = listVisiblePacksSubs(mode);

  if (mode === "argv") {
    const usage = `${c.bold(t("help.usage"))}\n  ${c.green("sfmc")} [options] <command> [args]\n`;
    const options = `
${c.bold(t("help.section.options"))}
${helpLine(`${c.green("-p")}, ${c.green("--packs")}`, t("help.opt.packs"))}
${helpLine(`${c.green("--lang")}, ${c.green("--locale")}`, t("help.opt.lang"))}
${helpLine(`${c.green("-h")}, ${c.green("--help")}`, t("help.help"))}
${helpLine(`${c.green("-v")}, ${c.green("--version")}`, t("help.version"))}
`;
    const service = [
      show("status") ? helpLine(p(mode, "status"), t("help.status")) : "",
      show("logs") ? helpLine(p(mode, "logs"), t("help.logs")) : "",
      show("start") ? helpLine(pArgs(mode, "start", " <svc>|-all"), t("help.start")) : "",
      show("stop") ? helpLine(pArgs(mode, "stop", " <svc>|-all"), t("help.stop")) : "",
      show("restart") ? helpLine(pArgs(mode, "restart", " <svc>|-all"), t("help.restart")) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const install = `
${c.bold(t("help.section.module"))}
${helpLine(`${c.green("sfmc install|i")} <id> […]`, t("help.module.install"))}
${helpLine(`${c.green("sfmc uninstall|remove")} <id>`, t("help.module.uninstall"))}
${helpLine(`${c.green("sfmc search")} [id]`, t("help.module.search"))}
${helpLine(`${c.green("sfmc verify")} [id]`, t("help.module.verify"))}
${helpLine(`${c.green("sfmc link")} [id]`, t("help.module.link"))}
${helpLine(`${c.green("sfmc create")}`, t("help.module.create"))}
${moduleHelpBlock("argv")}
`;

    const packsLines = packsSubs
      .map((sub) => {
        const short = sub === "install" ? "i|install" : sub;
        return helpLine(c.green(`sfmc packs ${short}`), "");
      })
      .join("\n");
    const addon =
      packsSubs.length > 0
        ? `
${c.bold(t("help.section.addon"))}
${packsLines}
${helpLine(c.dim("sfmc -p <sub> …"), t("help.addon.compat"))}
`
        : "";

    const update = show("update")
      ? `
${c.bold(t("help.section.update"))}
${helpLine(`${p(mode, "update")} [--check-only] [--channel=…]`, t("help.update"))}
`
      : "";
    const remote = show("remote")
      ? `
${c.bold(t("help.section.remote"))}  ${c.dim("[beta]")}
${helpLine(`${p(mode, "remote")} status|enroll|disable`, "")}
`
      : "";
    const debug = show("debug")
      ? `
${c.bold(t("help.section.debug"))}
${helpLine(`${c.blue("sfmc debug")} status|enable|disable|sentry …`, "")}
`
      : "";
    const general = [
      show("init") ? helpLine(p(mode, "init"), t("help.init")) : "",
      show("locale") ? helpLine(pArgs(mode, "locale", " [zh|en]"), t("help.locale")) : "",
    ]
      .filter(Boolean)
      .join("\n");

    return `
${c.bold("╭──────────────────────────────────────────────────────────╮")}
${c.bold("│")}  ${c.green(t("help.title"))}${" ".repeat(Math.max(1, 56 - t("help.title").length))}${c.bold("│")}
${c.bold("╰──────────────────────────────────────────────────────────╯")}

${usage}${options}
${c.bold(t("help.section.service"))}
${service}
${update}${remote}${debug}${install}${addon}
${c.bold(t("help.section.general"))}
${general}
`;
  }

  const service = [
    show("status") ? helpLine(p(mode, "status"), t("help.status")) : "",
    show("logs") ? helpLine(p(mode, "logs"), t("help.logs")) : "",
    show("start") ? helpLine(pArgs(mode, "start", " <svc>|-all"), t("help.start")) : "",
    show("stop") ? helpLine(pArgs(mode, "stop", " <svc>|-all"), t("help.stop")) : "",
    show("restart") ? helpLine(pArgs(mode, "restart", " <svc>|-all"), t("help.restart")) : "",
    show("send") ? helpLine(pArgs(mode, "send", " <svc> <msg>"), t("help.send")) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const moduleSec = `
${c.bold(t("help.section.module"))}
${moduleHelpBlock("repl")}
`;

  const packsLines = packsSubs.map((sub) => helpLine(c.green(`/packs ${sub}`), "")).join("\n");
  const addon =
    packsSubs.length > 0
      ? `
${c.bold(t("help.section.addon"))}
${packsLines}
`
      : "";

  const general = [
    show("version") ? helpLine(p(mode, "version"), t("help.version")) : "",
    show("help") ? helpLine(p(mode, "help"), t("help.help")) : "",
    show("quit") ? helpLine(p(mode, "quit"), t("help.quit")) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const shortcuts = `
${c.dim("────────────────────────────────────────────────────────────")}
${c.dim(t("help.shortcuts"))}
${helpLine(c.dim("/"), t("help.shortcut.slash"), 12)}
${helpLine(c.dim("Ctrl+P"), t("help.shortcut.ctrlp"), 12)}
${helpLine(c.dim("Tab"), t("help.shortcut.tab"), 12)}
${helpLine(c.dim("←→"), t("help.shortcut.cursor"), 12)}
${helpLine(c.dim("→"), t("help.shortcut.right"), 12)}
${helpLine(c.dim("Ctrl+L"), t("help.shortcut.ctrll"), 12)}
${helpLine(c.dim("↑↓"), t("help.shortcut.history"), 12)}
`;

  return `
${c.bold("╭──────────────────────────────────────────────────────────╮")}
${c.bold("│")}  ${c.green(t("help.title.repl"))}${" ".repeat(Math.max(1, 56 - t("help.title.repl").length))}${c.bold("│")}
${c.bold("╰──────────────────────────────────────────────────────────╯")}

${c.dim(t("help.slash.hint"))}

${c.bold(t("help.section.service"))}
${service}
${moduleSec}${addon}
${c.bold(t("help.section.general"))}
${general}
${shortcuts}`;
}
