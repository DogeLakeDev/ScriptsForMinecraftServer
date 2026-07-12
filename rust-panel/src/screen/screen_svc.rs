use crate::screen::Screen;
use crate::service::ServiceManager;
use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub struct SvcScreen {
    pub selected: usize,
}

impl SvcScreen {
    pub fn new() -> Self {
        Self { selected: 0 }
    }

    pub fn selected(&self) -> usize {
        self.selected
    }

    pub fn move_up(&mut self) {
        self.selected = self.selected.saturating_sub(1);
    }

    pub fn move_down(&mut self, max: usize) {
        if self.selected + 1 < max {
            self.selected += 1;
        }
    }
}

impl Screen for SvcScreen {
    fn update(&mut self) {}
    fn render(&mut self, _f: &mut Frame) {}
}

pub fn render_svc_screen(f: &mut Frame, services: &ServiceManager, ui: &mut SvcScreen) {
    let area = f.area();
    let chunks = Layout::vertical([
        Constraint::Length(2),
        Constraint::Min(5),
        Constraint::Length(2),
    ])
    .split(area);

    let title = Paragraph::new(" ⚙ 服务管理")
        .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD));
    f.render_widget(title, chunks[0]);

    let entries: [(&str, &str); 4] = [
        ("  DB  ", "db"),
        ("  QQ  ", "qq"),
        ("  BDS ", "bds"),
        ("  LLBot", "llbot"),
    ];

    let mut y = chunks[1].y;
    for (i, (label, name)) in entries.iter().enumerate() {
        let svc = services.get(name);
        let selected = i == ui.selected;
        let prefix = if selected { ">" } else { " " };
        let status = if svc.running { "RUN" } else { "STOP" };
        let pid_str = match svc.pid {
            Some(pid) => format!(" pid={}", pid),
            None => String::new(),
        };
        let restart_str = if svc.restart_at.is_some() {
            " waiting..."
        } else {
            ""
        };
        let line = format!("{}{} {} {}{}", prefix, label, status, pid_str, restart_str);

        let style = if selected {
            Style::default().bg(Color::Cyan).fg(Color::Black)
        } else {
            Style::default().fg(if svc.running { Color::Green } else { Color::DarkGray })
        };

        f.render_widget(
            Paragraph::new(Line::from(Span::styled(&line, style))),
            Rect::new(chunks[1].x, y, chunks[1].width, 1),
        );
        y += 1;
    }

    let help = Paragraph::new(Line::from(Span::styled(
        " s:start  x:stop  r:restart  arrows:select  Tab:switch  q:quit",
        Style::default().fg(Color::DarkGray),
    )));
    f.render_widget(help, chunks[2]);
}
