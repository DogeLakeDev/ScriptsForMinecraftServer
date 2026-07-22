import { confirm, intro, isCancel, multiselect, note, outro, select, tasks, text } from "@clack/prompts";
import {
  configPath,
  modulePath,
  patchJson as patchConfig,
  readJson,
  writeJson,
  type Catalog,
  type ConfigName,
  type ModuleLock,
} from "@sfmc-bds/sdk/node/config";
import JSZip from "jszip";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getAsset } from "node:sea";
import { IS_SEA, ROOT, spawnService } from "./runtime.js";
import { c } from "./theme.js";

/** 仓顶服务 config 浅合并写盘。委托 SDK 统一实现,禁止自己 mkdir+writeFileSync。 */
function patchJson<T extends object>(rootDir: string, name: ConfigName, updates: Partial<T>): void {
  patchConfig<T>(configPath(rootDir, name), updates);
}

function ensureDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true });
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

async function pickDirectory(message: string, defaultDirectory: string): Promise<string> {
  const method = await select({
    message,
    options: [
      { value: "text", label: "Enter path", hint: defaultDirectory },
      { value: "browse", label: "Browse...", hint: "open system folder picker" },
    ],
  });
  if (isCancel(method)) return defaultDirectory;
  if (method === "browse") return pickDirectoryDialog(message, defaultDirectory) ?? defaultDirectory;

  const selected = await text({ message, initialValue: defaultDirectory });
  return isCancel(selected) || !selected ? defaultDirectory : selected;
}

function pickDirectoryDialog(title: string, defaultDirectory: string): string | null {
  const escape = (value: string): string => value.replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${escape(title)}'`,
    `$dialog.SelectedPath = '${escape(defaultDirectory)}'`,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");

  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
      encoding: "utf-8",
      timeout: 30_000,
      windowsHide: true,
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

async function waitForHealth(port: number, ms = 15000): Promise<boolean> {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function extractZip(
  data: Buffer,
  destDir: string,
  options: { overwrite?: boolean } = { overwrite: true }
): Promise<string[]> {
  const zip = await JSZip.loadAsync(data);
  const files: string[] = [];

  const safeJoin = (base: string, relative: string): string => {
    const fullPath = path.resolve(base, relative);
    const relativePath = path.relative(base, fullPath);
    if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Path traversal detected: ${relative}`);
    }
    return fullPath;
  };

  const concurrency = 10;
  const entries = Object.keys(zip.files);
  const chunks = [];
  for (let i = 0; i < entries.length; i += concurrency) {
    chunks.push(entries.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (relPath) => {
        if (relPath.endsWith("/")) return;

        const file = zip.file(relPath);
        if (!file) return;

        const targetPath = safeJoin(destDir, relPath);
        if (!options.overwrite && fs.existsSync(targetPath)) {
          return;
        }

        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        const content = await file.async("nodebuffer");
        await fs.promises.writeFile(targetPath, content);
        files.push(relPath);
      })
    );
  }

  return files;
}

/** SEA asset: { zipBaseName, targetDirRelative, SEA_asset_name } */
const ASSETS = [
  { target: "configs", npmTarget: "configs", asset: "configs_default" },
  { target: "modules", npmTarget: "modules", asset: "modules" },
] as const;

function missingRuntimeAssets(rootDir: string): string[] {
  return ASSETS.flatMap(({ target, npmTarget }) => {
    const directory = path.join(rootDir, npmTarget);
    try {
      return fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length > 0 ? [] : [target];
    } catch {
      return [target];
    }
  });
}

async function runBdsUpdate(rootDir: string, channel: string): Promise<{ code: number | null; output: string }> {
  const child = spawnService("update", [`--channel=${channel}`, "--force", "--no-start"], {
    cwd: rootDir,
    stdio: "pipe",
  });
  const output: string[] = [];
  child.stdout?.on("data", (data: Buffer) => output.push(data.toString()));
  child.stderr?.on("data", (data: Buffer) => output.push(data.toString()));

  return new Promise((resolve) => {
    child.once("error", (error) => resolve({ code: null, output: `${output.join("")}${error.message}` }));
    child.once("close", (code) => resolve({ code, output: output.join("") }));
  });
}

async function prepareRuntimeAssets(rootDir: string): Promise<void> {
  if (!IS_SEA) {
    const missing = missingRuntimeAssets(rootDir);
    if (missing.length > 0) {
      throw new Error(`npm runtime is missing required directories: ${missing.join(", ")}`);
    }
    return;
  }

  await tasks([
    {
      title: "Extracting bundled assets",
      task: async (message) => {
        for (const { target, asset } of ASSETS) {
          message(`Extracting ${target}`);
          const assetBuffer = getAsset(asset);
          if (!assetBuffer) throw new Error(`Bundled asset not found: ${asset}`);

          const destDir = path.join(rootDir, target);
          if (!ensureDirectory(destDir)) throw new Error(`Cannot create asset directory: ${destDir}`);
          await extractZip(Buffer.from(assetBuffer), destDir, { overwrite: true });
        }
        return "Assets extracted";
      },
    },
  ]);
}

export async function runWizard(): Promise<void> {
  intro(c.bold("Setup Wizard =D"));

  const hasConfigs = fs.existsSync(configPath(ROOT, "db_config.json"));

  if (hasConfigs) {
    const r = await confirm({ message: "Configs already exist. Re-run setup?", initialValue: false });
    if (isCancel(r) || !r) {
      outro(c.dim("Setup skipped"));
      return;
    }
  }
  // Step 1: Runtime Environment
  const rootDir = ROOT;
  note(c.text(`Runtime root: ${rootDir}`), "Step 1 - Runtime Environment");

  try {
    await prepareRuntimeAssets(rootDir);
    patchJson(rootDir, "runtime.json", { runtime_root: rootDir, initialized_at: new Date().toISOString() });
  } catch (error) {
    outro(c.red(`Runtime preparation failed: ${(error as Error).message}`));
    return;
  }

  // Step 2: External runtime paths
  note(c.text("Select paths for BDS, Database, and LLBOT"), "Step 2 - External Runtimes");

  const bdsResolved = await pickDirectory("BDS installation directory", path.join(rootDir, "BDS"));
  if (!ensureDirectory(bdsResolved)) {
    outro(c.red(`Cannot create BDS installation directory: ${bdsResolved}`));
    return;
  }

  let llbotPath: string | undefined;
  const llbotEnabled = await confirm({ message: "Enable LLBot (QQ bridge)?", initialValue: false });
  if (!isCancel(llbotEnabled) && llbotEnabled) {
    const picked = await pickDirectory("LLBot runtime directory", path.join(rootDir, "LLBOT"));
    if (ensureDirectory(picked)) {
      llbotPath = picked;
    } else {
      llbotPath = path.join(rootDir, "LLBOT");
      note(c.text(`Using default: ${llbotPath}`), "TIPS");
    }
  }

  const dbDirInput = await pickDirectory("Database storage directory", path.join(rootDir, "data"));
  const dbDir = ensureDirectory(dbDirInput) ? dbDirInput : path.join(rootDir, "data");
  if (dbDir !== dbDirInput) {
    note(c.text(`Using default: ${dbDir}`), "TIPS");
  }
  const dbPortRaw = await text({
    message: "Database server port:",
    initialValue: "3001",
    validate: (v: any): any => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1024 || n > 65535) return "Enter 1024–65535";
      if (v.length === 0) return `Value is required!`;
    },
  });
  const dbPort = isCancel(dbPortRaw) ? 3001 : parseInt(dbPortRaw as string, 10);

  // Step 4: BDS environment
  const bdsExe = path.join(bdsResolved, "bedrock_server.exe");
  const bdsExists = fs.existsSync(bdsExe);

  note(
    bdsExists ? c.green(`Found at ${bdsResolved}`) : c.yellow(`Not found at ${bdsResolved}`),
    "Step 3 - BDS Environment"
  );

  const EULA = await confirm({
    message:
      "Do you agree to the EULA(https://www.minecraft.net/en-us/eula) published by Mojang? You must agree to it before you can use this program.",
    initialValue: false,
  });
  if (isCancel(EULA) || !EULA) {
    outro(c.yellow("Disagreed."));
    return;
  }

  let downloadBds = false;
  let bdsChannel = "release";
  let backupDir = path.join(path.dirname(bdsResolved), "backups");
  let preserve: string[] = [];

  if (!bdsExists) {
    const d = await confirm({ message: "Download BDS now?", initialValue: true });
    if (!isCancel(d) && d) {
      const ch = await select({
        message: "Select channel:",
        options: [
          { value: "release", label: "Release", hint: "stable" },
          { value: "preview", label: "Preview", hint: "may be unstable" },
        ],
      });
      if (!isCancel(ch)) {
        bdsChannel = ch as string;
        downloadBds = true;
      }
      if (!ensureDirectory(backupDir)) {
        outro(c.red(`Cannot create BDS backup directory: ${backupDir}`));
        return;
      }
    }
  }

  backupDir = await pickDirectory("BDS backup directory", backupDir);
  const pr = await multiselect({
    message: "Files to preserve on update(When updates are enabled next time):",
    options: [
      { value: "server.properties", label: "server.properties", hint: "server config", disabled: true },
      { value: "whitelist.json", label: "whitelist.json" },
      { value: "permissions.json", label: "permissions.json" },
      { value: "allowlist.json", label: "allowlist.json" },
      { value: "worlds", label: "worlds/", hint: "world data" },
      { value: "config", label: "config/", hint: "config directory", disabled: true },
    ],
    required: false,
  });
  if (!isCancel(pr)) preserve = pr as string[];
  note(
    c.yellow(
      "If could not find BDS runtime, updater will be started later.\n You can configure updater later in configs/bds_updater.json"
    ),
    "TIPS"
  );

  // Step 5: Module initialization
  const catalog = readJson<Catalog>(modulePath(rootDir, "catalog.json")) ?? {};
  const catalogModules: Array<{ id: string; name?: string; type?: string; description?: string }> = [];
  if (Array.isArray(catalog.modules)) {
    for (const m of catalog.modules) {
      const entry = m as Record<string, unknown>;
      catalogModules.push({
        id: String(entry.id ?? ""),
        name: String(entry.name ?? entry.id ?? ""),
        type: String(entry.type ?? "feature"),
        description: String(entry.description ?? ""),
      });
    }
  }

  note(
    c.text(catalogModules.length > 0 ? `Found ${catalogModules.length} optional modules` : "No modules catalog found"),
    "Step 4 - Modules"
  );

  let selectedModules: string[] = [];
  const coreMd: any[] = [];
  const featMd: any[] = [];
  catalogModules.forEach((k) => {
    if (k.type === "core") {
      coreMd.push({
        value: k.id,
        label: `${k.name}  (${k.type})`,
        hint: String(k.description ?? "(empty)"),
        disabled: true,
      });
    } else if (k.type === "feature") {
      featMd.push({
        value: k.id,
        label: `${k.name}  (${k.type})`,
        hint: String(k.description ?? "(empty)"),
      });
    }
  });
  if (catalogModules.length > 0) {
    const r = await multiselect({
      message: "Enable modules:",
      // merge core and feature module option arrays into a single options array
      options: [...coreMd, ...featMd],
      required: false,
    });
    if (!isCancel(r)) selectedModules = r as string[];
  }

  // Write paths into configs
  const t = [
    {
      title: "Updating configs",
      task: () => {
        const slashPath = (value: string) => value.replace(/\\/g, "/");
        patchJson(rootDir, "db_config.json", {
          db_port: dbPort,
          dbDir: slashPath(path.relative(rootDir, path.join(dbDir, "sfmc_data.db"))),
          modulesDir: "modules",
        });

        const llbotOn = !!llbotEnabled && !!llbotPath;
        patchJson(rootDir, "qq_config.json", {
          llbot_enabled: llbotOn,
          llbot_path: llbotPath ? slashPath(llbotPath) : "",
          llbot_cwd: llbotPath ? slashPath(llbotPath) : "",
        });
        patchJson(rootDir, "bds_updater.json", {
          bds_path: slashPath(bdsResolved),
          channel: bdsChannel,
          backup_dir: slashPath(backupDir),
          preserve,
          qq_notify: llbotOn,
        });
        return "Configs updated";
      },
    },
    {
      title: "Updating module state",
      task: async (): Promise<string> => {
        const lock = readJson<ModuleLock>(modulePath(rootDir, "module-lock.json")) ?? {
          version: 1,
          modules: {},
        };
        if (!lock.modules) lock.modules = {};
        const now = Date.now();
        for (const id of selectedModules) lock.modules[id] = { enabled: true, updatedAt: now };
        writeJson(modulePath(rootDir, "module-lock.json"), lock);
        return "Module state updated";
      },
    },
    {
      title: "Initializing database",
      task: async (): Promise<string> => {
        const child = spawnService("db", [], {
          cwd: rootDir,
          stdio: "ignore",
          env: { ...process.env, DB_PORT: String(dbPort) },
        });
        if (!(await waitForHealth(dbPort))) {
          child.kill("SIGTERM");
          return "Database startup timed out";
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000).unref();
        return "Database initialized";
      },
    },
  ];
  if (downloadBds) {
    t.push({
      title: "Downloading BDS",
      task: async (): Promise<string> => {
        const result = await runBdsUpdate(rootDir, bdsChannel);
        if (result.code !== 0) {
          return "Downloaded Failure.";
        }
        return "BDS downloaded";
      },
    });
  }
  try {
    await tasks(t);
  } catch (e) {
    outro(c.red(`Error: ${(e as Error).message}`));
    return;
  }

  /* install → build → deploy chain. If the user skipped module selection
   * earlier, this still runs `behavior-pack build` + `deploy` so the BP/
   * RP folders exist on disk — BDS just sees an empty script. */
  await runInstallBuildDeploy(rootDir, selectedModules, bdsResolved);

  outro(c.green("Done! Run help to learn managing."));
}

async function runInstallBuildDeploy(rootDir: string, selectedModules: string[], bdsResolved: string): Promise<void> {
  if (selectedModules.length > 0) {
    const fetchScript = path.join(rootDir, "tools", "fetch-module.mjs");
    if (fs.existsSync(fetchScript)) {
      const installT = [
        {
          title: `Installing ${selectedModules.length} module(s) from first-party registry`,
          task: async (): Promise<string> => {
            execFileSync(process.execPath, [fetchScript, "install", ...selectedModules], {
              cwd: rootDir,
              stdio: ["ignore", "pipe", "pipe"],
            });
            return `${selectedModules.length} installed`;
          },
        },
      ];
      try {
        await tasks(installT);
      } catch (e) {
        note(c.yellow(`install failed: ${(e as Error).message}\nYou can retry with: sfmc module install <id>`));
      }
    } else {
      note(
        c.yellow(
          `tools/fetch-module.mjs missing — run \`sfmc module install <id>\` later for each of: ${selectedModules.join(", ")}`
        )
      );
    }
  } else {
    note(
      c.dim(
        "No modules selected — behavior pack will be empty until you install one with `sfmc module install <id>`."
      )
    );
  }

  const { cmdBehaviorPackBuild, cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
  const buildT = [
    {
      title: "Building behavior pack",
      task: async (): Promise<string> => {
        const out = await cmdBehaviorPackBuild([]);
        if (out.startsWith("[31m")) throw new Error(out);
        return out;
      },
    },
  ];
  try {
    await tasks(buildT);
  } catch (e) {
    note(c.yellow(`build failed: ${(e as Error).message}\nRun \`sfmc behavior-pack build\` later to retry.`));
    return;
  }

  const deployT = [
    {
      title: `Deploying to ${bdsResolved}`,
      task: async (): Promise<string> => {
        const out = await cmdBehaviorPackDeploy([]);
        if (out.startsWith("[31m")) throw new Error(out);
        return out;
      },
    },
  ];
  try {
    await tasks(deployT);
    note(c.green("Restart BDS to load the new behavior pack."));
  } catch (e) {
    note(
      c.yellow(
        `deploy failed: ${(e as Error).message}\nRun \`sfmc behavior-pack deploy\` after fixing bds_root in configs/.`
      )
    );
  }
  void rootDir;
}
