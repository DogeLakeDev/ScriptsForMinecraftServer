use crate::client::DbClient;
use crate::screen::{dashboard::DashboardScreen, monitor::MonitorScreen, screen_svc::SvcScreen, Screen};
use crate::service::ServiceManager;
use anyhow::Result;
use std::path::PathBuf;

pub enum Tab {
    Dashboard,
    Monitor,
    Services,
}

pub struct App {
    pub active_tab: Tab,
    pub running: bool,
    pub db_client: DbClient,
    pub dashboard: DashboardScreen,
    pub monitor: MonitorScreen,
    pub svc_screen: SvcScreen,
    pub services: ServiceManager,
}

impl App {
    pub fn new() -> Result<Self> {
        let root_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let services = ServiceManager::new(&root_dir)?;

        Ok(Self {
            active_tab: Tab::Dashboard,
            running: true,
            db_client: DbClient::new("http://127.0.0.1:3001"),
            dashboard: DashboardScreen::new(),
            monitor: MonitorScreen::new(),
            svc_screen: SvcScreen::new(),
            services,
        })
    }

    pub fn current_screen(&mut self) -> &mut dyn Screen {
        match self.active_tab {
            Tab::Dashboard => &mut self.dashboard,
            Tab::Monitor => &mut self.monitor,
            Tab::Services => &mut self.svc_screen,
        }
    }

    pub fn quit(&mut self) {
        self.running = false;
    }
}
