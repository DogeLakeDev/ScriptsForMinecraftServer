import { confirm, intro, isCancel, note, outro, select, spinner, text } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { spawnService, spawnServiceSync } from "./runtime.js";
import { ROOT } from "./services.js";
import { c } from "./theme.js";

function cfg(name: string): string {
  return path.join(ROOT, "configs", name);
}

function read(file: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(cfg(file), "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function write(file: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(cfg(file)), { recursive: true });
  fs.writeFileSync(cfg(file), JSON.stringify(data, null, 2), "utf-8");
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

export async function runWizard(): Promise<void> {
  intro(c.bold("sfmc — Setup Wizard"));

  const hasConfigs = fs.existsSync(cfg("db_config.json"));

  if (hasConfigs) {
    const r = await confirm({ message: "Configs already exist. Re-run setup?", initialValue: false });
    if (isCancel(r) || !r) {
      outro(c.dim("Setup skipped"));
      return;
    }
  }

  const s = spinner();
  s.start("Checking environment");

  const bdsExists = (() => {
    try {
      const p = read("bds_updater.json").bds_path as string;
      return p ? fs.existsSync(path.join(p, "bedrock_server.exe")) : false;
    } catch {
      return false;
    }
  })();
  const hasDefaults = fs.existsSync(path.join(ROOT, "configs-default", "db_config.json"));

  s.stop(bdsExists ? "BDS found" : "BDS not found");
  note(c.text(`Root: ${ROOT}`), "Environment");

  let downloadBds = false;
  let bdsChannel = "release";

  if (!bdsExists) {
    const d = await confirm({ message: "BDS not found — download now?", initialValue: true });
    if (!isCancel(d) && d) {
      downloadBds = true;
      const ch = await select({
        message: "Select channel:",
        options: [
          { value: "release", label: "Release", hint: "stable" },
          { value: "preview", label: "Preview", hint: "may be unstable" },
        ],
      });
      if (isCancel(ch)) {
        downloadBds = false;
      } else {
        bdsChannel = ch as string;
      }
    }
  }

  let dbPort = 3001;
  if (hasConfigs) {
    dbPort = (read("db_config.json").db_port as number) ?? 3001;
  } else {
    const p = await text({
      message: "db-server port:",
      initialValue: "3001",
      validate: (v: string) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1024 || n > 65535) return "Enter 1024-65535";
        return;
      },
    });
    if (!isCancel(p)) dbPort = parseInt(p as string, 10);
  }

  let qqGroupId = 0;
  if (!hasConfigs) {
    const g = await text({
      message: "QQ group ID (0 to disable):",
      initialValue: "0",
      validate: (v: string) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 0) return "Enter a number ≥ 0";
        return;
      },
    });
    if (!isCancel(g)) qqGroupId = parseInt(g as string, 10);
  }

  s.start("Writing configs");
  try {
    if (!hasConfigs || (read("db_config.json").db_port as number) !== dbPort) {
      write("db_config.json", {
        _comment: "sfmc init wizard",
        db_port: dbPort,
        http_auth: "",
        dbDir: "../data/sfmc_data.db",
        modulesDir: "../modules",
      });
    }
    if (!hasConfigs) {
      write("qq_config.json", {
        _comment: "sfmc init wizard",
        qq_ws_port: 3002,
        qq_group_id: qqGroupId,
        llbot_enabled: qqGroupId > 0,
        llbot_host: "127.0.0.1",
        llbot_port: 3004,
        llbot_token: "",
        bridge_channel_id: "",
        mctoqq_prefix: "[MC]",
      });
      write("bds_updater.json", {
        _comment: "sfmc init wizard",
        bds_path: "D:\\Minecraft\\BEServer",
        backup_dir: "D:\\Minecraft\\BEServer_backups",
        channel: bdsChannel,
        preserve: ["server.properties", "whitelist.json", "permissions.json", "allowlist.json", "worlds", "config"],
        qq_notify: qqGroupId > 0,
        auto_check: true,
        crash_restart: true,
        auto_restart: true,
      });
      if (hasDefaults) {
        fs.cpSync(path.join(ROOT, "configs-default", "."), cfg("."), { recursive: true, force: false });
      }
    }
    s.stop("Configs written");
  } catch (e) {
    s.stop(c.red("Write failed"));
    outro(c.red(`Error: ${(e as Error).message}`));
    return;
  }

  if (downloadBds) {
    s.start("Downloading BDS");
    const result = spawnServiceSync("update", [`--channel=${bdsChannel}`, "--force"], {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 300000,
    });
    if (result.status === 0) {
      s.stop(c.green("BDS downloaded"));
    } else {
      s.stop(c.red("Download failed"));
      const errText = result.stderr?.toString() || result.error?.message || "unknown error";
      console.log(c.red(errText));
    }
  }

  s.start("Initializing DB");
  try {
    const child = spawnService("db", [], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, DB_PORT: String(dbPort) },
    });
    if (await waitForHealth(dbPort)) {
      await new Promise((r) => setTimeout(r, 1000));
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 3000);
      s.stop(c.green("Database initialized"));
    } else {
      s.stop(c.yellow("Timed out — start db-server manually"));
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  } catch {
    s.stop(c.yellow("Skipped — start manually"));
  }

  outro(c.green("Done! Run help to learning managing."));
}

