use crate::app::{App, Tab};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEventKind};

pub fn handle_events(app: &mut App) -> Result<bool> {
    if !event::poll(std::time::Duration::from_millis(200))? {
        app.current_screen().update();
        return Ok(true);
    }

    if let Event::Key(key) = event::read()? {
        if key.kind != KeyEventKind::Press {
            return Ok(true);
        }

        match key.code {
            KeyCode::Char('q') => {
                app.quit();
                return Ok(false);
            }
            KeyCode::Tab | KeyCode::Char('\t') => {
                app.active_tab = match app.active_tab {
                    Tab::Dashboard => Tab::Monitor,
                    Tab::Monitor => Tab::Services,
                    Tab::Services => Tab::Dashboard,
                };
            }
            KeyCode::Char('s') if matches!(app.active_tab, Tab::Services) => {
                let names: Vec<&str> = app.services.services.keys().copied().collect();
                let idx = app.svc_screen.selected().min(names.len().saturating_sub(1));
                if let Some(&name) = names.get(idx) {
                    let _ = app.services.start(name);
                }
            }
            KeyCode::Char('x') if matches!(app.active_tab, Tab::Services) => {
                let names: Vec<&str> = app.services.services.keys().copied().collect();
                let idx = app.svc_screen.selected().min(names.len().saturating_sub(1));
                if let Some(&name) = names.get(idx) {
                    let _ = app.services.stop(name);
                }
            }
            KeyCode::Char('r') if matches!(app.active_tab, Tab::Services) => {
                let names: Vec<&str> = app.services.services.keys().copied().collect();
                let idx = app.svc_screen.selected().min(names.len().saturating_sub(1));
                if let Some(&name) = names.get(idx) {
                    let _ = app.services.restart(name);
                }
            }
            KeyCode::Up => {
                app.svc_screen.move_up();
            }
            KeyCode::Down => {
                app.svc_screen.move_down(4);
            }
            KeyCode::Enter => {}
            KeyCode::Backspace => {}
            KeyCode::Esc => {}
            KeyCode::Char(_c) => {}
            _ => {}
        }
    }
    Ok(true)
}
