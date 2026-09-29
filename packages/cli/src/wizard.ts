import { confirm, intro, isCancel, multiselect, note, outro, password, select, spinner, tasks, text } from "@clack/prompts";
import {
  configPath,
  ensureCoreConfigs,
  modulePath,
  patchJson as patchConfig,
  readJson,
  withConfigSchema,
  writeJson,
  type Catalog,
  type ConfigName,
  type ModuleLock,
  type QQBridgeConfig,
} from "@sfmc-bds/sdk/node/config";
import { bdsExePath } from "@sfmc-bds/bds-tools/host-platform";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureDirectory, pickDirectory } from "./interactive-prompts.js";
import { persistLocale, t, type Locale } from "./i18n/index.js";
import { llbotExeName } from "./llbot-launch.js";
import { ROOT, isMonorepoLayout, isRuntimeInitialized, resolveFetchModule, spawnService } from "./runtime.js";
import { ensurePackUpdateConfigFile } from "./pack-update/index.js";
import { resolveRegistryIndex } from "./registry.js";
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

/** 运行时必需目录探测(configs / modules) */
const RUNTIME_DIRS = [
  { target: "configs", npmTarget: "configs" },
  { target: "modules", npmTarget: "modules" },
] as const;

function missingRuntimeAssets(rootDir: string): string[] {
  return RUNTIME_DIRS.flatMap(({ target, npmTarget }) => {
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
  /* monorepo 布局：configs/ modules/ 应由 pnpm workspace 提供 */
  if (isMonorepoLayout(rootDir)) {
    const missing = missingRuntimeAssets(rootDir);
    if (missing.length > 0) {
      throw new Error(t("wizard.runtimeMissingAssets", { list: missing.join(", ") }));
    }
    return;
  }

  seedNpmRuntimeLayout(rootDir);
}

/** 非 monorepo 的 npm 安装布局：ensure 配置骨架 + 空 modules */
function seedNpmRuntimeLayout(rootDir: string): void {
  ensureCoreConfigs(rootDir, ["db_config", "qq_config", "bds_updater", "permissions"]);
  /* pack-update 的 ensure 使用 runtime ROOT；npm 布局下应与 rootDir 一致 */
  if (path.resolve(rootDir) === path.resolve(ROOT)) {
    ensurePackUpdateConfigFile();
    void import("./module-update/index.js")
      .then((mod) => mod.ensureModuleUpdateConfigFile())
      .catch(() => {
        /* 策略文件稍后在 mod update / 开服时还会再确保一次 */
      });
  }

  const modulesRoot = path.join(rootDir, "modules");
  const packagesDir = path.join(modulesRoot, "packages");
  fs.mkdirSync(packagesDir, { recursive: true });

  const catalogPath = path.join(modulesRoot, "catalog.json");
  if (!fs.existsSync(catalogPath)) {
    writeJson(
      catalogPath,
      withConfigSchema({ version: 1, modules: [] }, "module_catalog", "modules")
    );
  }
  const lockPath = path.join(modulesRoot, "module-lock.json");
  if (!fs.existsSync(lockPath)) {
    writeJson(lockPath, { version: 1, modules: {} });
  }
}

/** 更新时默认保留的 BDS 文件，与逐项询问时的初始勾选相同。 */
const DEFAULT_PRESERVE = [
  "server.properties",
  "whitelist.json",
  "permissions.json",
  "allowlist.json",
  "worlds",
  "config",
] as const;

/** 向导写进 db / bds_updater 的路径与端口。 */
interface RuntimeLayout {
  dbDir: string;
  dbPort: number;
  backupDir: string;
  preserve: string[];
}

/** 向导收集的 QQ 桥选择。取消选择时不产生该对象。 */
interface QqWizardChoice {
  qqEnabled: boolean;
  qqBackend: "official" | "llbot";
  qqAppId: string;
  qqAppSecret: string;
  qqSandbox: boolean;
  qqGroupOpenid: string;
  llbotPath?: string;
  llbotEnabled: boolean;
}

/**
 * 数据库、备份目录和更新保留项。
 * 接受默认值时不再逐项提问；拒绝后仍询问目录、端口和保留项。取消单项时沿用该项默认。
 */
async function askRuntimeLayout(rootDir: string, bdsResolved: string): Promise<RuntimeLayout> {
  const defaultDbDir = path.join(rootDir, "data");
  const defaultBackup = path.join(path.dirname(bdsResolved), "backups");
  const useDefaults = await confirm({
    message: t("wizard.useDefaults"),
    initialValue: true,
  });
  if (isCancel(useDefaults) || useDefaults) {
    ensureDirectory(defaultDbDir);
    note(
      c.text(
        t("wizard.defaultsApplied", {
          db: defaultDbDir,
          port: "3001",
          backup: defaultBackup,
        })
      ),
      t("common.tips")
    );
    note(c.yellow(t("wizard.updaterTip")), t("common.tips"));
    return {
      dbDir: defaultDbDir,
      dbPort: 3001,
      backupDir: defaultBackup,
      preserve: [...DEFAULT_PRESERVE],
    };
  }

  const dbDirInput = await pickDirectory(t("wizard.dbDir"), defaultDbDir);
  const dbDir = ensureDirectory(dbDirInput) ? dbDirInput : defaultDbDir;
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
  const backupDir = await pickDirectory(t("wizard.backupDir"), defaultBackup);
  const preserveOptions = [
    { value: "server.properties", label: "server.properties", hint: t("wizard.preserve.serverProps") },
    { value: "whitelist.json", label: "whitelist.json" },
    { value: "permissions.json", label: "permissions.json" },
    { value: "allowlist.json", label: "allowlist.json" },
    { value: "worlds", label: "worlds/", hint: t("wizard.preserve.worlds") },
    { value: "config", label: "config/", hint: t("wizard.preserve.config") },
  ] as const;
  const pr = await multiselect({
    message: t("wizard.preserve"),
    options: [...preserveOptions],
    initialValues: [...DEFAULT_PRESERVE],
    required: false,
  });
  note(c.yellow(t("wizard.updaterTip")), t("common.tips"));
  return {
    dbDir,
    dbPort,
    backupDir,
    preserve: isCancel(pr) ? [] : (pr as string[]),
  };
}

/**
 * 选择 QQ 桥后端。默认不启用。
 * 取消时返回 null，调用方结束向导且不写入 initialized_at。
 */
async function askQqBridge(rootDir: string): Promise<QqWizardChoice | null> {
  const qqBackendPick = await select({
    message: t("wizard.qqBackend"),
    options: [
      { value: "disabled", label: t("wizard.qqBackend.disabled"), hint: t("wizard.qqBackend.disabledHint") },
      { value: "official", label: t("wizard.qqBackend.official"), hint: t("wizard.qqBackend.officialHint") },
      { value: "llbot", label: t("wizard.qqBackend.llbot"), hint: t("wizard.qqBackend.llbotHint") },
    ],
    initialValue: "disabled",
  });
  if (isCancel(qqBackendPick)) return null;

  const qqBackendChoice = String(qqBackendPick || "disabled");
  if (qqBackendChoice === "disabled") {
    return {
      qqEnabled: false,
      qqBackend: "official",
      qqAppId: "",
      qqAppSecret: "",
      qqSandbox: false,
      qqGroupOpenid: "",
      llbotEnabled: false,
    };
  }
  if (qqBackendChoice === "llbot") {
    const picked = await pickDirectory(t("wizard.llbotDir"), path.join(rootDir, "LLBOT"));
    let llbotPath = picked;
    if (!ensureDirectory(picked)) {
      llbotPath = path.join(rootDir, "LLBOT");
      note(c.text(t("wizard.usingDefault", { path: llbotPath })), t("common.tips"));
    }
    return {
      qqEnabled: true,
      qqBackend: "llbot",
      qqAppId: "",
      qqAppSecret: "",
      qqSandbox: false,
      qqGroupOpenid: "",
      llbotPath,
      llbotEnabled: true,
    };
  }

  const appIdRaw = await text({
    message: t("wizard.qqAppId"),
    placeholder: "102xxxxx",
    validate: (v: any): any => {
      if (!String(v ?? "").trim()) return t("wizard.valueRequired");
    },
  });
  const secretRaw = await password({
    message: t("wizard.qqAppSecret"),
    validate: (v: any): any => {
      if (!String(v ?? "").trim()) return t("wizard.valueRequired");
    },
  });
  const sandboxPick = await confirm({
    message: t("wizard.qqSandbox"),
    initialValue: false,
  });
  const openidRaw = await text({
    message: t("wizard.qqGroupOpenid"),
    placeholder: t("wizard.qqGroupOpenidHint"),
  });
  return {
    qqEnabled: true,
    qqBackend: "official",
    qqAppId: isCancel(appIdRaw) ? "" : String(appIdRaw).trim(),
    qqAppSecret: isCancel(secretRaw) ? "" : String(secretRaw).trim(),
    qqSandbox: isCancel(sandboxPick) ? false : !!sandboxPick,
    qqGroupOpenid: isCancel(openidRaw) ? "" : String(openidRaw).trim(),
    llbotEnabled: false,
  };
}

/**
 * 选择要启用或安装的模块。
 * 目录里已有模块时只问启停；空目录才读官方索引，避免把启用和安装混成同一次选择。
 */
async function askModules(rootDir: string): Promise<string[]> {
  const catalog = readJson<Catalog>(modulePath(rootDir, "catalog.json")) ?? {
    version: 1,
    modules: [],
  };
  const catalogModules: Array<{ id: string; name?: string; description?: string; canDisable?: boolean }> = [];
  if (Array.isArray(catalog.modules)) {
    for (const m of catalog.modules) {
      catalogModules.push({
        id: String(m.id ?? ""),
        name: String(m.name ?? m.id ?? ""),
        description: String(m.description ?? ""),
        canDisable: m.canDisable !== false,
      });
    }
  }

  if (catalogModules.length > 0) {
    note(c.text(t("wizard.modulesFound", { count: catalogModules.length })), t("wizard.step4"));
    const lockedMd: Array<{ value: string; label: string; hint: string; disabled?: boolean }> = [];
    const optionalMd: Array<{ value: string; label: string; hint: string }> = [];
    for (const k of catalogModules) {
      const option = {
        value: k.id,
        label: String(k.name),
        hint: String(k.description ?? t("wizard.emptyHint")),
      };
      if (k.canDisable === false) lockedMd.push({ ...option, disabled: true });
      else optionalMd.push(option);
    }
    const picked = await multiselect({
      message: t("wizard.enableModules"),
      options: [...lockedMd, ...optionalMd],
      required: false,
    });
    return isCancel(picked) ? [] : (picked as string[]);
  }

  note(c.text(t("wizard.modulesNone")), t("wizard.step4"));
  const spin = spinner();
  spin.start(t("wizard.registryLoading"));
  const { index } = await resolveRegistryIndex();
  const ids = Object.keys(index).sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) {
    spin.stop(t("wizard.registryOffline"));
    return [];
  }
  spin.stop(t("wizard.modulesFound", { count: String(ids.length) }));
  const picked = await multiselect({
    message: t("wizard.installFromRegistry"),
    options: ids.map((id) => ({ value: id, label: id })),
    required: false,
  });
  return isCancel(picked) ? [] : (picked as string[]);
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
  // Step 1: Runtime Environment（只播种 configs/modules，不写 initialized_at、不建 data/）
  const rootDir = ROOT;
  note(c.text(t("wizard.runtimeRoot", { root: rootDir })), t("wizard.step1"));

  try {
    await prepareRuntimeAssets(rootDir);
  } catch (error) {
    outro(c.red(t("wizard.prepFailed", { message: (error as Error).message })));
    return;
  }

  // Step 2: BDS 目录。数据库和 QQ 放到后面，能用默认值就不再逐项问。
  note(c.text(t("wizard.step2Note")), t("wizard.step2"));

  const bdsResolved = await pickDirectory(t("wizard.bdsDir"), path.join(rootDir, "BDS"));
  if (!ensureDirectory(bdsResolved)) {
    outro(c.red(t("wizard.cannotCreateBds", { dir: bdsResolved })));
    return;
  }

  // Step 3: 先确认可执行文件和 EULA，再决定要不要下载。
  const bdsExe = bdsExePath(bdsResolved);
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

  if (!bdsExists) {
    const d = await confirm({ message: t("wizard.downloadBds"), initialValue: true });
    if (!isCancel(d) && d) {
      const ch = await select({
        message: t("wizard.selectChannel"),
        options: [
          { value: "release", label: t("wizard.channel.release"), hint: t("wizard.channel.releaseHint") },
          { value: "preview", label: t("wizard.channel.preview"), hint: t("wizard.channel.previewHint") },
        ],
        initialValue: "release",
      });
      if (!isCancel(ch)) {
        bdsChannel = ch as string;
        downloadBds = true;
      }
    }
  }

  const { dbDir, dbPort, backupDir, preserve } = await askRuntimeLayout(rootDir, bdsResolved);
  if (downloadBds && !ensureDirectory(backupDir)) {
    outro(c.red(t("wizard.cannotCreateBackup", { dir: backupDir })));
    return;
  }

  const qq = await askQqBridge(rootDir);
  if (!qq) {
    outro(c.dim(t("wizard.skipped")));
    return;
  }
  const { qqEnabled, qqBackend, qqAppId, qqAppSecret, qqSandbox, qqGroupOpenid, llbotPath, llbotEnabled } = qq;

  const selectedModules = await askModules(rootDir);

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

        const llbotOn = qqBackend === "llbot" && !!llbotEnabled && !!llbotPath;
        const qqNotify = qqEnabled && (qqBackend === "official" || llbotOn);
        const exeName = llbotExeName();
        const currentQq = readJson<QQBridgeConfig>(configPath(rootDir, "qq_config.json")) ?? {};
        patchJson(rootDir, "qq_config.json", {
          qq_enabled: qqEnabled,
          qq_backend: qqBackend,
          official: {
            ...currentQq.official,
            app_id: qqAppId,
            app_secret: qqAppSecret,
            sandbox: qqSandbox,
            group_openid: qqGroupOpenid,
          },
          llbot: {
            ...currentQq.llbot,
            enabled: llbotOn,
            // path = 可执行文件；cwd = 运行目录（向导选的是目录）
            path: llbotPath ? slashPath(path.join(llbotPath, exeName)) : "",
            cwd: llbotPath ? slashPath(llbotPath) : "",
          },
        });
        patchJson(rootDir, "bds_updater.json", {
          bds_path: slashPath(bdsResolved),
          channel: bdsChannel,
          backup_dir: slashPath(backupDir),
          preserve,
          qq_notify: qqNotify,
        });
        /* 路径选定后再标记已初始化，避免半途取消仍留下 data/ 语义 */
        patchJson(rootDir, "runtime.json", {
          runtime_root: rootDir,
          initialized_at: new Date().toISOString(),
          locale: isCancel(langPick) ? undefined : (langPick as string),
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

        /* /api/health 在 listen 之后才返回，而建表发生在 listen 之前，不必再空等。 */
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
            /* 向导里勾选的启停已经写入 lock，安装时保留，不用清单里的默认值覆盖。 */
            execFileSync(process.execPath, [fetchScript, "install", ...selectedModules, "--preserve-lock"], {
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
