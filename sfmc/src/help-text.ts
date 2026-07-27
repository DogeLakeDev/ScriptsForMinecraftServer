/**
 * help-text.ts — argv / REPL 帮助文案（按 command-surface 通道过滤）
 */
import {
  getVisibleModuleSubcommands,
  isDeveloperSubcommand,
} from "./module-commands.js";
import { listVisiblePacksSubs, listVisibleTopLevelNames, type CommandMode } from "./command-surface.js";
import { t } from "./i18n/index.js";
import { c } from "./theme.js";

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

function hasTop(mode: CommandMode, name: string): boolean {
  return listVisibleTopLevelNames(mode).includes(name);
}

function moduleHelpBlock(mode: CommandMode): string {
  const visible = new Set(getVisibleModuleSubcommands(mode));
  const entries = MODULE_HELP_ENTRIES.filter(({ sub }) => visible.has(sub));
  return entries
    .map(({ sub, suffix, key }) => {
      const paint = isDeveloperSubcommand(sub) ? c.blue : c.green;
      if (mode === "argv") {
        return `  ${paint(`sfmc module ${sub}`)}${suffix}\n                                   ${t(key as never)}`;
      }
      return `  ${paint(`/module ${sub}`)}${suffix}\n                                   ${t(key as never)}`;
    })
    .join("\n");
}

function p(mode: CommandMode, cmd: string, paint: (s: string) => string = c.green): string {
  return mode === "argv" ? paint(`sfmc ${cmd}`) : paint(`/${cmd}`);
}

export function getHelp(mode: CommandMode = "argv"): string {
  const show = (name: string) => hasTop(mode, name);
  const packsSubs = listVisiblePacksSubs(mode);

  if (mode === "argv") {
    const usage = `${c.bold(t("help.usage"))}\n  ${c.green("sfmc")} [options] <command> [args]\n`;
    const options = `
${c.bold(t("help.section.options"))}
  ${c.green("-p")}, ${c.green("--packs")}          ${t("help.opt.packs")}
  ${c.green("--lang")}, ${c.green("--locale")}     ${t("help.opt.lang")}
  ${c.green("-h")}, ${c.green("--help")}           ${t("help.help")}
  ${c.green("-v")}, ${c.green("--version")}        ${t("help.version")}
`;
    const service = [
      show("status") ? `  ${p(mode, "status")}                    ${t("help.status")}` : "",
      show("logs") ? `  ${p(mode, "logs")} <svc> [-n N]         ${t("help.logs")}` : "",
      show("start") ? `  ${p(mode, "start")} <svc>|-all          ${t("help.start")}` : "",
      show("stop") ? `  ${p(mode, "stop")} <svc>|-all           ${t("help.stop")}` : "",
      show("restart") ? `  ${p(mode, "restart")} <svc>|-all        ${t("help.restart")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const install = `
${c.bold(t("help.section.module"))}
  ${c.green("sfmc i|install")} <id> […]     ${t("help.module.install")}
${moduleHelpBlock("argv")}
`;

    const packsLines = packsSubs
      .map((sub) => {
        const short = sub === "install" ? "i|install" : sub;
        return `  ${c.green(`sfmc -p ${short}`)}`;
      })
      .join("\n");
    const addon =
      packsSubs.length > 0
        ? `
${c.bold(t("help.section.addon"))}
${packsLines}
  ${c.dim("sfmc packs|addon <sub> …")}   ${t("help.addon.compat")}
`
        : "";

    const update = show("update")
      ? `
${c.bold(t("help.section.update"))}
  ${p(mode, "update")} [--check-only] [--channel=release|preview]
                                   ${t("help.update")}
`
      : "";
    const remote = show("remote")
      ? `
${c.bold(t("help.section.remote"))}  ${c.dim("[beta]")}
  ${p(mode, "remote")} status|enroll|disable
`
      : "";
    const debug = show("debug")
      ? `
${c.bold(t("help.section.debug"))}
  ${c.blue("sfmc debug")} status|enable|disable|sentry …
`
      : "";
    const general = [
      show("init") ? `  ${p(mode, "init")}                      ${t("help.init")}` : "",
      show("locale") ? `  ${p(mode, "locale")} [zh|en]            ${t("help.locale")}` : "",
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
    show("status") ? `  ${p(mode, "status")}                    ${t("help.status")}` : "",
    show("logs") ? `  ${p(mode, "logs")} <svc> [-n N] [-f]    ${t("help.logs")}` : "",
    show("start") ? `  ${p(mode, "start")} <svc>|-all          ${t("help.start")}` : "",
    show("stop") ? `  ${p(mode, "stop")} <svc>|-all           ${t("help.stop")}` : "",
    show("restart") ? `  ${p(mode, "restart")} <svc>|-all        ${t("help.restart")}` : "",
    show("send") ? `  ${p(mode, "send")} <svc> <msg>          ${t("help.send")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const moduleSec = `
${c.bold(t("help.section.module"))}
${moduleHelpBlock("repl")}
`;

  const packsLines = packsSubs.map((sub) => `  ${c.green(`/packs ${sub}`)}`).join("\n");
  const addon =
    packsSubs.length > 0
      ? `
${c.bold(t("help.section.addon"))}
${packsLines}
`
      : "";

  const general = [
    show("version") ? `  ${p(mode, "version")}                   ${t("help.version")}` : "",
    show("help") ? `  ${p(mode, "help")}                      ${t("help.help")}` : "",
    show("quit") ? `  ${p(mode, "quit")}                      ${t("help.quit")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const shortcuts = `
${c.dim("────────────────────────────────────────────────────────────")}
${c.dim(t("help.shortcuts"))}
  ${c.dim("/")}         ${t("help.shortcut.slash")}
  ${c.dim("Ctrl+P")}    ${t("help.shortcut.ctrlp")}
  ${c.dim("Tab")}       ${t("help.shortcut.tab")}
  ${c.dim("←→")}        ${t("help.shortcut.cursor")}
  ${c.dim("→")}         ${t("help.shortcut.right")}
  ${c.dim("Ctrl+L")}    ${t("help.shortcut.ctrll")}
  ${c.dim("↑↓")}        ${t("help.shortcut.history")}
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
