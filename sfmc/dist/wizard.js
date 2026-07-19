import { confirm, intro, isCancel, multiselect, note, outro, select, spinner, text } from "@clack/prompts";
import cliProgress from "cli-progress";
import JSZip from "jszip";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { spawnService, spawnServiceSync } from "./runtime.js";
import { ROOT } from "./services.js";
import { c } from "./theme.js";
function cfg(rootDir, name) {
    return path.join(rootDir, "configs", name);
}
function write(rootDir, file, data) {
    const target = cfg(rootDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
}
async function waitForHealth(port, ms = 15000) {
    const t = Date.now();
    while (Date.now() - t < ms) {
        try {
            if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)
                return true;
        }
        catch {
            /* retry */
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    return false;
}
function pickFolder(title) {
    const ps = [
        `Add-Type -AssemblyName System.Windows.Forms`,
        `$b = New-Object System.Windows.Forms.FolderBrowserDialog`,
        `$b.Description = '${title.replace(/'/g, "''")}'`,
        `$b.ShowDialog() | Out-Null`,
        `Write-Output $b.SelectedPath`,
    ].join("; ");
    try {
        const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf-8",
            timeout: 30000,
        });
        return out.trim() || null;
    }
    catch {
        return null;
    }
}
function listFiles(dir, prefix = "") {
    const result = [];
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                result.push(...listFiles(path.join(dir, entry.name), rel));
            }
            else {
                result.push(rel);
            }
        }
    }
    catch {
        /* dir may not exist */
    }
    return result;
}
async function extractZip(data, destDir) {
    const zip = await JSZip.loadAsync(data);
    const files = [];
    zip.forEach((relPath) => {
        if (!relPath.endsWith("/"))
            files.push(relPath);
    });
    fs.mkdirSync(destDir, { recursive: true });
    for (const relPath of files) {
        const file = zip.file(relPath);
        if (!file)
            continue;
        const target = path.join(destDir, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const buf = await file.async("nodebuffer");
        fs.writeFileSync(target, buf);
    }
    return files;
}
async function extractDefaults(rootDir) {
    const s = spinner();
    s.start("Checking bundled assets");
    const defaultsDir = path.join(rootDir, "configs-default");
    const configsDir = path.join(rootDir, "configs");
    if (fs.existsSync(configsDir) && fs.readdirSync(configsDir).length > 0) {
        s.stop("Configs already exist");
        return;
    }
    let data = null;
    const getAsset = process.getBuiltinAsset;
    if (typeof getAsset === "function") {
        try {
            const raw = getAsset("configs_default");
            data = Buffer.from(raw);
        }
        catch {
            /* not available */
        }
    }
    s.stop("Extracting configs");
    if (data) {
        const files = await extractZip(data, configsDir);
        if (files.length > 0) {
            const bar = new cliProgress.SingleBar({ format: ` {bar} {percentage}% | {value}/{total} files | {file}` }, cliProgress.Presets.shades_classic);
            bar.start(files.length, 0, { file: "" });
            for (const f of files) {
                bar.increment({ file: f });
                await new Promise((r) => setTimeout(r, 5));
            }
            bar.stop();
        }
    }
    else if (fs.existsSync(defaultsDir)) {
        const files = listFiles(defaultsDir);
        const bar = new cliProgress.SingleBar({ format: ` {bar} {percentage}% | {value}/{total} files | {file}` }, cliProgress.Presets.shades_classic);
        bar.start(files.length, 0, { file: "" });
        fs.mkdirSync(configsDir, { recursive: true });
        for (const file of files) {
            const src = path.join(defaultsDir, file);
            const dest = path.join(configsDir, file);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
            bar.increment({ file });
        }
        bar.stop();
    }
    else {
        fs.mkdirSync(configsDir, { recursive: true });
        note(c.yellow("No bundled configs found — created empty configs/ directory"), "Notice");
    }
}
export async function runWizard() {
    intro(c.bold("sfmc — Setup Wizard"));
    const hasConfigs = fs.existsSync(cfg(ROOT, "db_config.json"));
    if (hasConfigs) {
        const r = await confirm({ message: "Configs already exist. Re-run setup?", initialValue: false });
        if (isCancel(r) || !r) {
            outro(c.dim("Setup skipped"));
            return;
        }
    }
    // ── Step 1: Runtime environment ──────────────────────────────────
    note(c.text("First, select where this server runs"), "Step 1 — Runtime Environment");
    const runtimeEnv = await select({
        message: "Runtime environment:",
        options: [
            { value: "local", label: "Local", hint: "run on this machine" },
            { value: "remote", label: "Remote", hint: "connect to remote server (not yet implemented)" },
        ],
    });
    if (isCancel(runtimeEnv)) {
        outro(c.dim("Setup cancelled"));
        return;
    }
    let rootDir = ROOT;
    if (runtimeEnv === "local") {
        const picked = pickFolder("Select server root directory");
        if (picked && fs.existsSync(picked)) {
            rootDir = picked;
        }
        else {
            note(c.text(`Using default: ${ROOT}`), "Server directory");
        }
    }
    else {
        outro(c.yellow("Remote mode not yet implemented — skipping setup"));
        return;
    }
    note(c.text(`Server root: ${rootDir}`), "Confirmed");
    // ── Step 2: Extract bundled defaults ────────────────────────────
    await extractDefaults(rootDir);
    // ── Step 3: External runtime paths ────────────────────────────────
    note(c.text("Select paths for BDS, LLBOT, and database"), "Step 2 — External Runtimes");
    const bdsPath = pickFolder("Select BDS installation directory");
    const bdsResolved = bdsPath || path.join(rootDir, "BDServer");
    let llbotPath;
    const llbotEnabled = await confirm({ message: "Enable LLBot (QQ bridge)?", initialValue: false });
    if (!isCancel(llbotEnabled) && llbotEnabled) {
        const picked = pickFolder("Select LLBot directory");
        if (picked)
            llbotPath = picked;
    }
    const dbDir = pickFolder("Select database storage directory");
    const dbResolved = dbDir || path.join(rootDir, "data");
    const dbPortRaw = await text({
        message: "Database server port:",
        initialValue: "3001",
        validate: (v) => {
            const n = parseInt(v, 10);
            if (isNaN(n) || n < 1024 || n > 65535)
                return "Enter 1024–65535";
            return;
        },
    });
    const dbPort = isCancel(dbPortRaw) ? 3001 : parseInt(dbPortRaw, 10);
    // ── Step 4: BDS environment ──────────────────────────────────────
    const bdsExe = path.join(bdsResolved, "bedrock_server.exe");
    const bdsExists = fs.existsSync(bdsExe);
    note(bdsExists ? c.green(`Found at ${bdsResolved}`) : c.yellow(`Not found at ${bdsResolved}`), "Step 3 — BDS Environment");
    let downloadBds = false;
    let bdsChannel = "release";
    let backupDir = "";
    let preserve = [];
    if (!bdsExists) {
        const d = await confirm({ message: "Download BDS now?", initialValue: true });
        if (!isCancel(d) && d) {
            downloadBds = true;
            const ch = await select({
                message: "Select channel:",
                options: [
                    { value: "release", label: "Release", hint: "stable" },
                    { value: "preview", label: "Preview", hint: "may be unstable" },
                ],
            });
            if (!isCancel(ch))
                bdsChannel = ch;
            const bd = await text({ message: "Backup directory (empty to disable):", initialValue: "" });
            if (!isCancel(bd))
                backupDir = bd;
            const pr = await multiselect({
                message: "Files to preserve on update:",
                options: [
                    { value: "server.properties", label: "server.properties", hint: "server config" },
                    { value: "whitelist.json", label: "whitelist.json" },
                    { value: "permissions.json", label: "permissions.json" },
                    { value: "allowlist.json", label: "allowlist.json" },
                    { value: "worlds", label: "worlds/", hint: "world data" },
                    { value: "config", label: "config/", hint: "config directory" },
                ],
                required: false,
            });
            if (!isCancel(pr))
                preserve = pr;
        }
        else {
            note(c.yellow("You can configure BDS path later in configs/bds_updater.json"), "Skipped");
        }
    }
    // ── Step 5: Module initialization ─────────────────────────────────
    const catalogPath = path.join(rootDir, "modules", "catalog.json");
    const catalogModules = [];
    try {
        const raw = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
        if (Array.isArray(raw.modules)) {
            for (const m of raw.modules) {
                const entry = m;
                if (String(entry.type) === "core")
                    continue;
                catalogModules.push({
                    id: String(entry.id ?? ""),
                    name: String(entry.name ?? entry.id ?? ""),
                    type: String(entry.type ?? "feature"),
                    description: String(entry.description ?? ""),
                });
            }
        }
    }
    catch {
        /* catalog not found */
    }
    note(c.text(catalogModules.length > 0 ? `Found ${catalogModules.length} optional modules` : "No modules catalog found"), "Step 4 — Modules");
    let selectedModules = [];
    if (catalogModules.length > 0) {
        const r = await multiselect({
            message: "Enable modules:",
            options: catalogModules.map((m) => ({
                value: m.id,
                label: `${m.name}  (${m.type})`,
                ...(m.description ? { hint: m.description } : {}),
            })),
            required: false,
        });
        if (!isCancel(r))
            selectedModules = r;
    }
    // ── Write configs ─────────────────────────────────────────────────
    const s = spinner();
    s.start("Writing configs");
    try {
        write(rootDir, "db_config.json", {
            _comment: "sfmc init wizard",
            db_port: dbPort,
            http_auth: "",
            dbDir: path.relative(rootDir, dbResolved) || dbResolved,
            modulesDir: "../modules",
        });
        write(rootDir, "qq_config.json", {
            _comment: "sfmc init wizard",
            qq_ws_port: 3002,
            qq_group_id: 0,
            llbot_enabled: !!llbotEnabled && !!llbotPath,
            llbot_host: "127.0.0.1",
            llbot_port: 3004,
            llbot_token: "",
            llbot_path: llbotPath ? llbotPath.replace(/\\/g, "\\\\") : "",
            llbot_cwd: llbotPath ? llbotPath.replace(/\\/g, "\\\\") : "",
            bridge_channel_id: "",
            mctoqq_prefix: "[MC]",
        });
        write(rootDir, "bds_updater.json", {
            _comment: "sfmc init wizard",
            bds_path: bdsResolved.replace(/\\/g, "\\\\"),
            backup_dir: backupDir ? backupDir.replace(/\\/g, "\\\\") : "",
            channel: bdsChannel,
            preserve: preserve.length > 0
                ? preserve
                : ["server.properties", "whitelist.json", "permissions.json", "allowlist.json", "worlds", "config"],
            qq_notify: !!llbotEnabled && !!llbotPath,
            auto_check: true,
            crash_restart: true,
            auto_restart: true,
        });
        write(rootDir, "settings.json", {
            _comment: "sfmc init wizard",
            afk_time: 120,
            qa_interval_min: 600,
            qa_interval_max: 720,
            qa_timeout: 60,
            clean_item_max: 192,
            clean_poll_interval: 60,
            clean_kill_list: ["shitcraft:shit"],
        });
        s.stop("Configs written");
    }
    catch (e) {
        s.stop(c.red("Write failed"));
        outro(c.red(`Error: ${e.message}`));
        return;
    }
    // ── Write module-lock.json ──────────────────────────────────────
    if (selectedModules.length > 0) {
        s.start("Updating module state");
        try {
            const lockPath = path.join(rootDir, "modules", "module-lock.json");
            let lock = {
                version: 1,
                modules: {},
            };
            try {
                lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
            }
            catch {
                /* start fresh */
            }
            if (!lock.modules)
                lock.modules = {};
            const now = Date.now();
            for (const id of selectedModules) {
                lock.modules[id] = { enabled: true, updatedAt: now };
            }
            fs.mkdirSync(path.dirname(lockPath), { recursive: true });
            fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), "utf-8");
            s.stop("Module state updated");
        }
        catch (e) {
            s.stop(c.yellow("Module state write failed"));
        }
    }
    // ── Download BDS ─────────────────────────────────────────────────
    if (downloadBds) {
        s.start("Downloading BDS");
        const result = spawnServiceSync("update", [`--channel=${bdsChannel}`, "--force"], {
            cwd: rootDir,
            stdio: "pipe",
            timeout: 300000,
        });
        if (result.status === 0) {
            s.stop(c.green("BDS downloaded"));
        }
        else {
            s.stop(c.red("Download failed"));
            const errText = result.stderr?.toString() || result.error?.message || "unknown error";
            console.log(c.red(errText));
        }
    }
    // ── Init DB ──────────────────────────────────────────────────────
    s.start("Initializing database");
    try {
        const child = spawnService("db", [], {
            cwd: rootDir,
            stdio: "ignore",
            env: { ...process.env, DB_PORT: String(dbPort) },
        });
        if (await waitForHealth(dbPort)) {
            await new Promise((r) => setTimeout(r, 1000));
            child.kill("SIGTERM");
            setTimeout(() => {
                try {
                    child.kill("SIGKILL");
                }
                catch {
                    /* ignore */
                }
            }, 3000);
            s.stop(c.green("Database initialized"));
        }
        else {
            s.stop(c.yellow("Timed out — start db-server manually"));
            try {
                child.kill("SIGTERM");
            }
            catch {
                /* ignore */
            }
        }
    }
    catch {
        s.stop(c.yellow("Skipped — start manually"));
    }
    outro(c.green("Done! Run help to learn managing."));
}
//# sourceMappingURL=wizard.js.map