mod app;
mod client;
mod event;
mod screen;
mod service;
mod ui;

use anyhow::Result;
use app::App;
use crossterm::{
    cursor,
    event::{DisableMouseCapture, EnableMouseCapture},
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;

fn main() -> Result<()> {
    terminal::enable_raw_mode()?;
    let mut stdout = io::stdout();
    crossterm::execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new()?;
    let res = run_app(&mut terminal, &mut app);

    terminal::disable_raw_mode()?;
    crossterm::execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture,
        cursor::Show
    )?;
    terminal.show_cursor()?;

    if let Err(e) = res {
        eprintln!("错误: {e}");
    }
    Ok(())
}

fn run_app(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, app: &mut App) -> Result<()> {
    loop {
        terminal.draw(|f| ui::render(f, app))?;
        if !event::handle_events(app)? {
            break;
        }
    }
    Ok(())
}
