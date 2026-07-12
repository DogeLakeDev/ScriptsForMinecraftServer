use anyhow::{Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct ServiceDef {
    pub name: &'static str,
    pub title: &'static str,
    pub cmd: String,
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub graceful_stop: GracefulStop,
    pub auto_restart: bool,
    pub restart_delay: Duration,
}

#[derive(Clone)]
pub enum GracefulStop {
    Stdin(String),
    Term,
}

pub struct Service {
    pub def: ServiceDef,
    pub running: bool,
    pub pid: Option<u32>,
    pub child: Option<Child>,
    pub manual_stop: bool,
    pub restart_at: Option<Instant>,
}

pub struct ServiceManager {
    pub services: HashMap<&'static str, Service>,
}

impl ServiceManager {
    pub fn get(&self, name: &str) -> &Service {
        self.services.get(name).expect("unknown service")
    }

    pub fn new(root_dir: &PathBuf) -> Result<Self> {
        let configs_dir = root_dir.join("configs");

        let bds_cfg = read_json::<BdsUpdaterConfig>(&configs_dir.join("bds_updater.json"))
            .unwrap_or_default();
        let qq_cfg =
            read_json::<QqConfig>(&configs_dir.join("qq_config.json")).unwrap_or_default();

        let mut services: HashMap<&'static str, Service> = HashMap::new();

        services.insert(
            "db",
            Service {
                def: ServiceDef {
                    name: "db",
                    title: "DB",
                    cmd: "node".into(),
                    args: vec!["db-server/index.js".into()],
                    cwd: Some(root_dir.clone()),
                    graceful_stop: GracefulStop::Term,
                    auto_restart: true,
                    restart_delay: Duration::from_secs(3),
                },
                running: false,
                pid: None,
                child: None,
                manual_stop: false,
                restart_at: None,
            },
        );

        services.insert(
            "qq",
            Service {
                def: ServiceDef {
                    name: "qq",
                    title: "QQ",
                    cmd: "node".into(),
                    args: vec!["qq-bridge/index.js".into()],
                    cwd: Some(root_dir.clone()),
                    graceful_stop: GracefulStop::Term,
                    auto_restart: true,
                    restart_delay: Duration::from_secs(3),
                },
                running: false,
                pid: None,
                child: None,
                manual_stop: false,
                restart_at: None,
            },
        );

        services.insert(
            "bds",
            Service {
                def: ServiceDef {
                    name: "bds",
                    title: "BDS",
                    cmd: "bedrock_server.exe".into(),
                    args: vec![],
                    cwd: Some(bds_cfg.bds_path.clone()),
                    graceful_stop: GracefulStop::Stdin("stop\n".into()),
                    auto_restart: bds_cfg.crash_restart,
                    restart_delay: Duration::from_secs(bds_cfg.crash_restart_delay.max(1) as u64),
                },
                running: false,
                pid: None,
                child: None,
                manual_stop: false,
                restart_at: None,
            },
        );

        services.insert(
            "llbot",
            Service {
                def: ServiceDef {
                    name: "llbot",
                    title: "LLBot",
                    cmd: qq_cfg.llbot_path.clone(),
                    args: vec![],
                    cwd: Some(qq_cfg.llbot_cwd.clone()),
                    graceful_stop: GracefulStop::Term,
                    auto_restart: true,
                    restart_delay: Duration::from_secs(5),
                },
                running: false,
                pid: None,
                child: None,
                manual_stop: false,
                restart_at: None,
            },
        );

        Ok(Self { services })
    }

    pub fn start(&mut self, name: &str) -> Result<()> {
        let svc = self.services.get_mut(name).context("unknown service")?;
        if svc.running {
            return Ok(());
        }
        svc.manual_stop = false;
        svc.restart_at = None;

        let mut cmd = Command::new(&svc.def.cmd);
        cmd.args(&svc.def.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(ref cwd) = svc.def.cwd {
            cmd.current_dir(cwd);
        }
        let child = cmd.spawn().context(format!("启动 {} 失败", svc.def.name))?;

        let pid = child.id();
        svc.child = Some(child);
        svc.pid = Some(pid);
        svc.running = true;
        Ok(())
    }

    pub fn stop(&mut self, name: &str) -> Result<()> {
        let svc = self.services.get_mut(name).context("unknown service")?;
        if !svc.running {
            return Ok(());
        }
        svc.manual_stop = true;
        svc.restart_at = None;

        match &svc.def.graceful_stop {
            GracefulStop::Stdin(msg) => {
                if let Some(child) = svc.child.as_mut() {
                    if let Some(stdin) = child.stdin.as_mut() {
                        let _ = stdin.write_all(msg.as_bytes());
                        let _ = stdin.flush();
                    }
                }
            }
            GracefulStop::Term => {
                if let Some(ref mut child) = svc.child {
                    let _ = child.kill();
                }
            }
        }

        // give it a moment, then force kill
        std::thread::sleep(Duration::from_millis(500));
        if let Some(ref mut child) = svc.child {
            let _ = child.wait();
        }
        svc.running = false;
        svc.pid = None;
        svc.child = None;
        Ok(())
    }

    pub fn restart(&mut self, name: &str) -> Result<()> {
        self.stop(name)?;
        self.start(name)
    }

    pub fn poll(&mut self) {
        let names: Vec<&'static str> = self.services.keys().copied().collect();
        for name in names {
            let svc = self.services.get_mut(name).unwrap();

            // check restart timer
            if !svc.running && !svc.manual_stop {
                if let Some(at) = svc.restart_at {
                    if Instant::now() >= at {
                        svc.restart_at = None;
                        let _ = self.start(name);
                        continue;
                    }
                }
            }

            // check child status
            if let Some(ref mut child) = svc.child {
                match child.try_wait() {
                    Ok(Some(_status)) => {
                        svc.running = false;
                        svc.pid = None;
                        let _ = child.wait();
                        svc.child = None;

                        if !svc.manual_stop && svc.def.auto_restart {
                            let delay = svc.def.restart_delay;
                            svc.restart_at = Some(Instant::now() + delay);
                        }
                    }
                    Ok(None) => {}
                    Err(_) => {
                        svc.running = false;
                        svc.pid = None;
                        svc.child = None;
                    }
                }
            }
        }
    }
}

#[derive(Deserialize, Default)]
struct BdsUpdaterConfig {
    #[serde(default = "default_bds_path")]
    bds_path: PathBuf,
    #[serde(default)]
    crash_restart: bool,
    #[serde(default = "default_delay")]
    crash_restart_delay: u64,
}

fn default_bds_path() -> PathBuf {
    PathBuf::from("D:\\Minecraft\\BEServer")
}

fn default_delay() -> u64 {
    5
}

#[derive(Deserialize, Default)]
struct QqConfig {
    #[serde(default = "default_llbot_path")]
    llbot_path: String,
    #[serde(default = "default_llbot_cwd")]
    llbot_cwd: PathBuf,
}

fn default_llbot_path() -> String {
    "D:\\LLBot-CLI-win-x64\\llbot.exe".into()
}

fn default_llbot_cwd() -> PathBuf {
    PathBuf::from("D:\\LLBot-CLI-win-x64")
}

fn read_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}
