pub mod dashboard;
pub mod monitor;
pub mod screen_svc;

use ratatui::Frame;

pub trait Screen {
    fn update(&mut self);
    fn render(&mut self, f: &mut Frame);
}
