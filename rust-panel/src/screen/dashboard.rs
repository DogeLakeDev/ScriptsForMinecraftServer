use crate::screen::Screen;
use ratatui::{
    layout::{Constraint, Layout},
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};
use std::collections::VecDeque;

pub struct LogEntry {
    pub text: String,
    pub level: LogLevel,
}

pub enum LogLevel {
    Info,
    Success,
    Warning,
    Error,
}

pub struct DashboardScreen {
    pub logs: VecDeque<LogEntry>,
    pub input: String,
}

impl DashboardScreen {
    pub fn new() -> Self {
        let mut logs = VecDeque::new();
        logs.push_back(LogEntry {
            text: "面板已启动".into(),
            level: LogLevel::Success,
        });
        logs.push_back(LogEntry {
            text: "按 Tab 切换标签页".into(),
            level: LogLevel::Info,
        });
        logs.push_back(LogEntry {
            text: "按 q 退出".into(),
            level: LogLevel::Info,
        });
        Self {
            logs,
            input: String::new(),
        }
    }

    pub fn push_log(&mut self, text: &str, level: LogLevel) {
        if self.logs.len() > 1000 {
            self.logs.pop_front();
        }
        self.logs.push_back(LogEntry {
            text: text.into(),
            level,
        });
    }
}

impl Screen for DashboardScreen {
    fn update(&mut self) {}

    fn render(&mut self, f: &mut Frame) {
        let area = f.area();
        let chunks = Layout::vertical([Constraint::Min(1), Constraint::Length(3)]).split(area);

        let log_items: Vec<ListItem> = self
            .logs
            .iter()
            .rev()
            .take(area.height.saturating_sub(4) as usize)
            .rev()
            .map(|entry| {
                let (color, prefix) = match entry.level {
                    LogLevel::Error => (Color::Red, "[x]"),
                    LogLevel::Warning => (Color::Yellow, "[!]"),
                    LogLevel::Success => (Color::Green, "[√]"),
                    LogLevel::Info => (Color::Cyan, "[*]"),
                };
                ListItem::new(Line::from(Span::styled(
                    format!("{prefix} {}", entry.text),
                    Style::default().fg(color),
                )))
            })
            .collect();

        let log_block = Block::default()
            .title(" 日志 ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray));
        let log_list = List::new(log_items).block(log_block);
        f.render_widget(log_list, chunks[0]);

        let input_block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray));
        let input_p = Paragraph::new(if self.input.is_empty() {
            "█".into()
        } else {
            format!("{}█", self.input)
        })
        .block(input_block)
        .wrap(Wrap { trim: false });
        f.render_widget(input_p, chunks[1]);
    }
}
