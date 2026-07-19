import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { configPath } from "@sfmc/config";
import { applyEdits, modify, parse, type FormattingOptions, type ParseError } from "jsonc-parser/lib/esm/main.js";
import { IS_SEA, ROOT } from "./runtime.js";

const PROFILE_NAME = "SFMC";

type TerminalProfileState = {
  guid: string;
  starting_directory: string;
};

type TerminalSettings = {
  profiles?: { list?: Array<Record<string, unknown>> };
  [key: string]: unknown;
};

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

const JSONC_FORMAT: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: "\r\n" };

function readTerminalSettings(file: string): TerminalSettings | null {
  try {
    const errors: ParseError[] = [];
    const settings = parse(fs.readFileSync(file, "utf-8"), errors) as TerminalSettings;
    if (errors.length === 0) return settings;
    throw new Error("invalid JSONC");
  } catch {
    console.warn(`[terminal] skipped invalid Windows Terminal settings: ${file}`);
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function terminalSettingsFiles(): string[] {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];

  const packages = ["Microsoft.WindowsTerminal_8wekyb3d8bbwe", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe"];
  return packages
    .map((packageName) => path.join(localAppData, "Packages", packageName, "LocalState", "settings.json"))
    .filter((file) => fs.existsSync(file));
}

function preferredPowerShell(): string {
  const programFiles = [process.env.ProgramW6432, process.env.ProgramFiles].filter(
    (value): value is string => Boolean(value)
  );
  const candidates = [
    ...programFiles.map((base) => path.join(base, "PowerShell", "7", "pwsh.exe")),
    ...programFiles.map((base) => path.join(base, "PowerShell", "7-preview", "pwsh.exe")),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WindowsApps", "pwsh.exe"),
  ];

  const installed = candidates.find((candidate) => fs.existsSync(candidate));
  if (installed) return installed;
  if (spawnSync("pwsh.exe", ["-NoProfile", "-Command", "exit"], { stdio: "ignore", windowsHide: true }).status === 0) {
    return "pwsh.exe";
  }
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function newGuid(): string {
  return `{${crypto.randomUUID()}}`;
}

function profile(guid: string, startingDirectory: string, commandline: string): Record<string, unknown> {
  return {
    altGrAliasing: true,
    antialiasingMode: "grayscale",
    backgroundImage: "desktopWallpaper",
    backgroundImageOpacity: 0.15,
    closeOnExit: "automatic",
    colorScheme: "One Half Dark",
    commandline,
    cursorColor: "#98C379",
    cursorShape: "filledBox",
    font: {
      axes: { ital: 0, wght: 400, rlig: 1 },
      size: 12,
      weight: "semi-bold",
    },
    guid,
    hidden: false,
    historySize: 9001,
    icon: "\ud83d\udd25",
    intenseTextStyle: "all",
    name: PROFILE_NAME,
    opacity: 100,
    padding: "8, 8, 8, 8",
    scrollbarState: "visible",
    snapOnInput: true,
    startingDirectory,
    tabTitle: PROFILE_NAME,
    useAcrylic: false,
  };
}

function editSettings(settingsFile: string, edits: ReturnType<typeof modify>): void {
  if (edits.length === 0) return;
  const source = fs.readFileSync(settingsFile, "utf-8");
  fs.writeFileSync(settingsFile, applyEdits(source, edits), "utf-8");
}

function removeManagedProfiles(settingsFile: string, settings: TerminalSettings, state: TerminalProfileState): void {
  const list = settings.profiles?.list;
  if (!Array.isArray(list)) return;

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const item = list[index];
    if (item && (item.guid === state.guid || item.name === PROFILE_NAME)) {
      editSettings(settingsFile, modify(fs.readFileSync(settingsFile, "utf-8"), ["profiles", "list", index], undefined, { formattingOptions: JSONC_FORMAT }));
    }
  }
}

function updateProfile(settingsFile: string, state: TerminalProfileState, commandline: string): void {
  const settings = readTerminalSettings(settingsFile);
  if (!settings) return;
  removeManagedProfiles(settingsFile, settings, state);
  const refreshed = readTerminalSettings(settingsFile);
  if (!refreshed) return;
  const list = refreshed.profiles?.list;
  const pathToList = Array.isArray(list) ? ["profiles", "list", -1] : ["profiles", "list"];
  const value = Array.isArray(list)
    ? profile(state.guid, state.starting_directory, commandline)
    : [profile(state.guid, state.starting_directory, commandline)];
  editSettings(settingsFile, modify(fs.readFileSync(settingsFile, "utf-8"), pathToList, value, { formattingOptions: JSONC_FORMAT, isArrayInsertion: Array.isArray(list) }));
}

function removeProfile(settingsFile: string, state: TerminalProfileState): void {
  const settings = readTerminalSettings(settingsFile);
  if (!settings) return;
  removeManagedProfiles(settingsFile, settings, state);
}

function terminalState(runtimeFile: string, startingDirectory: string): TerminalProfileState {
  const runtime = readJson<Record<string, unknown>>(runtimeFile, {});
  const saved = runtime.terminal_profile as Partial<TerminalProfileState> | undefined;
  const changed = saved?.starting_directory !== startingDirectory || !saved.guid;

  if (changed && saved?.guid) {
    for (const settingsFile of terminalSettingsFiles()) removeProfile(settingsFile, saved as TerminalProfileState);
  }

  const state: TerminalProfileState = changed
    ? { guid: newGuid(), starting_directory: startingDirectory }
    : (saved as TerminalProfileState);
  writeJson(runtimeFile, { ...runtime, terminal_profile: state });
  return state;
}

function windowsTerminalAvailable(): boolean {
  return spawnSync("wt.exe", ["--version"], { stdio: "ignore", windowsHide: true }).status === 0;
}

/** Keep the dedicated Windows Terminal profile in sync with the SEA executable location. */
export function ensureSeaTerminalProfile(): void {
  if (!IS_SEA || process.platform !== "win32" || process.env.SFMC_SERVICE) return;

  const settingsFiles = terminalSettingsFiles();
  if (settingsFiles.length === 0 || !windowsTerminalAvailable()) return;

  const runtimeFile = configPath(ROOT, "runtime.json");
  const state = terminalState(runtimeFile, path.dirname(process.execPath));
  for (const settingsFile of settingsFiles) updateProfile(settingsFile, state, preferredPowerShell());
}
