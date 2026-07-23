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
import { ensureDirectory, pickDirectory } from "./interactive-prompts.js";
import { persistLocale, t, type Locale } from "./i18n/index.js";
import { IS_SEA, ROOT, isMonorepoLayout, isRuntimeInitialized, resolveDefaultsDir, resolveFetchModule, spawnService } from "./runtime.js";
import { c } from "./theme.js";

/** Shallow-merge write for top-level configs. Delegates to SDK; do not mkdir+writeFileSync here. */
function patchJson<T extends object>(rootDir: string, name: ConfigName, updates: Partial<T>): void {
  patchConfig<T>(configPath(rootDir, name), updates);
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
  if (IS_SEA) {
    await tasks([
      {
        title: t("wizard.extractAssets"),
        task: async (message) => {
          for (const { target, asset } of ASSETS) {
            message(t("wizard.extracting", { target }));
            const assetBuffer = getAsset(asset);
            if (!assetBuffer) throw new Error(t("wizard.assetMissing", { asset }));

            const destDir = path.join(rootDir, target);
            if (!ensureDirectory(destDir)) throw new Error(t("wizard.cannotCreateAssetDir", { dir: destDir }));
            await extractZip(Buffer.from(assetBuffer), destDir, { overwrite: true });
          }
          return t("wizard.assetsExtracted");
        },
      },
    ]);
    return;
  }

  /* monorepo??? configs/ modules/?npm ?????????? */
  if (isMonorepoLayout(rootDir)) {
    const missing = missingRuntimeAssets(rootDir);
    if (missing.length > 0) {
      throw new Error(t("wizard.npmMissing", { list: missing.join(", ") }));
    }
    return;
  }

  seedNpmRuntimeLayout(rootDir);
}

/** ? npm ??/?????? configs + modules ??????????? */
function seedNpmRuntimeLayout(rootDir: string): void {
  const defaultsDir = resolveDefaultsDir();
  const configsDest = path.join(rootDir, "configs");
  fs.mkdirSync(configsDest, { recursive: true });

  if (defaultsDir) {
    const src = fs.existsSync(path.join(defaultsDir, "configs"))
      ? path.join(defaultsDir, "configs")
      : defaultsDir;
    for (const name of fs.readdirSync(src)) {
      if (!name.endsWith(".json")) continue;
      const dest = path.join(configsDest, name);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(src, name), dest);
      }
    }
  }

  const modulesRoot = path.join(rootDir, "modules");
  const packagesDir = path.join(modulesRoot, "packages");
  fs.mkdirSync(packagesDir, { recursive: true });

  const catalogPath = path.join(modulesRoot, "catalog.json");
  if (!fs.existsSync(catalogPath)) {
    writeJson(catalogPath, { version: 1, modules: [] });
  }
  const lockPath = path.join(modulesRoot, "module-lock.json");
  if (!fs.existsSync(lockPath)) {
    writeJson(lockPath, { version: 1, modules: {} });
  }
}

export async function runWizard(): Promise<void> {
  intro(c.bold(t("wizard.intro")));

  const langPick = await select({
    message: t("locale.wizard"),
    options: [
      { value: "zh-CN", label: t("locale.opt.zh") },
      { value: "en", label: t("locale.opt.en") },
    ],
    initialValue: "zh-CN",
  });
  if (!isCancel(langPick)) {
    persistLocale(ROOT, langPick as Locale);
  }

  // Already initialized only when runtime.json#initialized_at is set (empty db_config skeleton does not count).
  if (isRuntimeInitialized()) {
    const r = await confirm({ message: t("wizard.rerun"), initialValue: false });
    if (isCancel(r) || !r) {
      outro(c.dim(t("wizard.skipped")));
      return;
    }
  }
  // Step 1: Runtime Environment
  const rootDir = ROOT;
  note(c.text(t("wizard.runtimeRoot", { root: rootDir })), t("wizard.step1"));

  try {
    await prepareRuntimeAssets(rootDir);
    patchJson(rootDir, "runtime.json", {
      runtime_root: rootDir,
      initialized_at: new Date().toISOString(),
      locale: isCancel(langPick) ? undefined : (langPick as string),
    });
  } catch (error) {
    outro(c.red(t("wizard.prepFailed", { message: (error as Error).message })));
    return;
  }

  // Step 2: External runtime paths
  note(c.text(t("wizard.step2Note")), t("wizard.step2"));

  const bdsResolved = await pickDirectory(t("wizard.bdsDir"), path.join(rootDir, "BDS"));
  if (!ensureDirectory(bdsResolved)) {
    outro(c.red(t("wizard.cannotCreateBds", { dir: bdsResolved })));
    return;
  }

  let llbotPath: string | undefined;
  const llbotEnabled = await confirm({ message: t("wizard.enableLlbot"), initialValue: false });
  if (!isCancel(llbotEnabled) && llbotEnabled) {
    const picked = await pickDirectory(t("wizard.llbotDir"), path.join(rootDir, "LLBOT"));
    if (ensureDirectory(picked)) {
      llbotPath = picked;
    } else {
      llbotPath = path.join(rootDir, "LLBOT");
      note(c.text(t("wizard.usingDefault", { path: llbotPath })), t("common.tips"));
    }
  }

  const dbDirInput = await pickDirectory(t("wizard.dbDir"), path.join(rootDir, "data"));
  const dbDir = ensureDirectory(dbDirInput) ? dbDirInput : path.join(rootDir, "data");
  if (dbDir !== dbDirInput) {
    note(c.text(t("wizard.usingDefault", { path: dbDir })), t("common.tips"));
  }
  const dbPortRaw = await text({
    message: t("wizard.dbPort"),
    initialValue: "3001",
    validate: (v: any): any => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1024 || n > 65535) return t("wizard.portRange");
      if (v.length === 0) return t("wizard.valueRequired");
    },
  });
  const dbPort = isCancel(dbPortRaw) ? 3001 : parseInt(dbPortRaw as string, 10);

  // Step 3: BDS environment
  const bdsExe = path.join(bdsResolved, "bedrock_server.exe");
  const bdsExists = fs.existsSync(bdsExe);

  note(
    bdsExists
      ? c.green(t("wizard.bdsFound", { path: bdsResolved }))
      : c.yellow(t("wizard.bdsNotFound", { path: bdsResolved })),
    t("wizard.step3")
  );

  const EULA = await confirm({
    message: t("wizard.eula"),
    initialValue: false,
  });
  if (isCancel(EULA) || !EULA) {
    outro(c.yellow(t("wizard.disagreed")));
    return;
  }

  let downloadBds = false;
  let bdsChannel = "release";
  let backupDir = path.join(path.dirname(bdsResolved), "backups");
  let preserve: string[] = [];

  if (!bdsExists) {
    const d = await confirm({ message: t("wizard.downloadBds"), initialValue: true });
    if (!isCancel(d) && d) {
      const ch = await select({
        message: t("wizard.selectChannel"),
        options: [
          { value: "release", label: t("wizard.channel.release"), hint: t("wizard.channel.releaseHint") },
          { value: "preview", label: t("wizard.channel.preview"), hint: t("wizard.channel.previewHint") },
        ],
      });
      if (!isCancel(ch)) {
        bdsChannel = ch as string;
        downloadBds = true;
      }
      if (!ensureDirectory(backupDir)) {
        outro(c.red(t("wizard.cannotCreateBackup", { dir: backupDir })));
        return;
      }
    }
  }

  backupDir = await pickDirectory(t("wizard.backupDir"), backupDir);
  const pr = await multiselect({
    message: t("wizard.preserve"),
    options: [
      { value: "server.properties", label: "server.properties", hint: t("wizard.preserve.serverProps"), disabled: true },
      { value: "whitelist.json", label: "whitelist.json" },
      { value: "permissions.json", label: "permissions.json" },
      { value: "allowlist.json", label: "allowlist.json" },
      { value: "worlds", label: "worlds/", hint: t("wizard.preserve.worlds") },
      { value: "config", label: "config/", hint: t("wizard.preserve.config"), disabled: true },
    ],
    required: false,
  });
  if (!isCancel(pr)) preserve = pr as string[];
  note(c.yellow(t("wizard.updaterTip")), t("common.tips"));

  // Step 4: Module initialization
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
    c.text(
      catalogModules.length > 0
        ? t("wizard.modulesFound", { count: catalogModules.length })
        : t("wizard.modulesNone")
    ),
    t("wizard.step4")
  );

  let selectedModules: string[] = [];
  const coreMd: any[] = [];
  const featMd: any[] = [];
  catalogModules.forEach((k) => {
    if (k.type === "core") {
      coreMd.push({
        value: k.id,
        label: `${k.name}  (${k.type})`,
        hint: String(k.description ?? t("wizard.emptyHint")),
        disabled: true,
      });
    } else if (k.type === "feature") {
      featMd.push({
        value: k.id,
        label: `${k.name}  (${k.type})`,
        hint: String(k.description ?? t("wizard.emptyHint")),
      });
    }
  });
  if (catalogModules.length > 0) {
    const r = await multiselect({
      message: t("wizard.enableModules"),
      options: [...coreMd, ...featMd],
      required: false,
    });
    if (!isCancel(r)) selectedModules = r as string[];
  }

  const wizardTasks = [
    {
      title: t("wizard.updatingConfigs"),
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
        return t("wizard.configsUpdated");
      },
    },
    {
      title: t("wizard.updatingModules"),
      task: async (): Promise<string> => {
        const lock = readJson<ModuleLock>(modulePath(rootDir, "module-lock.json")) ?? {
          version: 1,
          modules: {},
        };
        if (!lock.modules) lock.modules = {};
        const now = Date.now();
        for (const id of selectedModules) lock.modules[id] = { enabled: true, updatedAt: now };
        writeJson(modulePath(rootDir, "module-lock.json"), lock);
        return t("wizard.modulesUpdated");
      },
    },
    {
      title: t("wizard.initDb"),
      task: async (): Promise<string> => {
        const child = spawnService("db", [], {
          cwd: rootDir,
          stdio: "ignore",
          env: { ...process.env, DB_PORT: String(dbPort) },
        });
        if (!(await waitForHealth(dbPort))) {
          child.kill("SIGTERM");
          return t("wizard.dbTimeout");
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000).unref();
        return t("wizard.dbOk");
      },
    },
  ];
  if (downloadBds) {
    wizardTasks.push({
      title: t("wizard.downloadingBds"),
      task: async (): Promise<string> => {
        const result = await runBdsUpdate(rootDir, bdsChannel);
        if (result.code !== 0) {
          return t("wizard.downloadFail");
        }
        return t("wizard.bdsDownloaded");
      },
    });
  }
  try {
    await tasks(wizardTasks);
  } catch (e) {
    outro(c.red(t("common.error", { message: (e as Error).message })));
    return;
  }

  /* install → build → deploy chain */
  await runInstallBuildDeploy(rootDir, selectedModules, bdsResolved);

  outro(c.green(t("wizard.done")));
}

async function runInstallBuildDeploy(rootDir: string, selectedModules: string[], bdsResolved: string): Promise<void> {
  if (selectedModules.length > 0) {
    const fetchScript = resolveFetchModule();
    if (fetchScript) {
      const installT = [
        {
          title: t("wizard.installing", { count: selectedModules.length }),
          task: async (): Promise<string> => {
            execFileSync(process.execPath, [fetchScript, "install", ...selectedModules], {
              cwd: rootDir,
              stdio: ["ignore", "pipe", "pipe"],
              env: { ...process.env, SFMC_ROOT: rootDir },
            });
            return t("wizard.installed", { count: selectedModules.length });
          },
        },
      ];
      try {
        await tasks(installT);
      } catch (e) {
        note(c.yellow(t("wizard.installFailed", { message: (e as Error).message })));
      }
    } else {
      note(c.yellow(t("wizard.fetchMissing", { list: selectedModules.join(", ") })));
    }
  } else {
    note(c.dim(t("wizard.noModulesSelected")));
  }

  const { cmdBehaviorPackBuild, cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
  const buildT = [
    {
      title: t("wizard.buildingBp"),
      task: async (): Promise<string> => {
        const r = await cmdBehaviorPackBuild([]);
        if (!r.ok) throw new Error(r.message);
        return r.message;
      },
    },
  ];
  try {
    await tasks(buildT);
  } catch (e) {
    note(c.yellow(t("wizard.buildFailed", { message: (e as Error).message })));
    return;
  }

  const deployT = [
    {
      title: t("wizard.deploying", { path: bdsResolved }),
      task: async (): Promise<string> => {
        const r = await cmdBehaviorPackDeploy([]);
        if (!r.ok) throw new Error(r.message);
        return r.message;
      },
    },
  ];
  try {
    await tasks(deployT);
    note(c.green(t("wizard.restartBds")));
  } catch (e) {
    note(c.yellow(t("wizard.deployFailed", { message: (e as Error).message })));
  }
  void rootDir;
}
