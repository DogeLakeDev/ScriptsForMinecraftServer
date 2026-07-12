use crate::screen::Screen;
use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};
use std::time::Instant;
use sysinfo::{Disks, Networks, System};

const BAR_WIDTH: usize = 20;

fn fmt_mem(bytes: u64) -> String {
    let gb = bytes as f64 / 1_073_741_824.0;
    if gb >= 1.0 {
        format!("{:.1} GB", gb)
    } else {
        format!("{} MB", bytes / 1_048_576)
    }
}

fn bar_chars(pct: f64, width: usize) -> (String, String) {
    let filled = (pct / 100.0 * width as f64).round() as usize;
    let filled = filled.min(width);
    let empty = width - filled;
    ("█".repeat(filled), "░".repeat(empty))
}

fn pct_color(pct: f64) -> Color {
    if pct >= 90.0 {
        Color::Red
    } else if pct >= 70.0 {
        Color::Yellow
    } else {
        Color::Green
    }
}

pub struct MonitorScreen {
    sys: System,
    disks: Disks,
    networks: Networks,
    last_poll: Instant,
    cpu_pct: f64,
    mem_total: u64,
    mem_used: u64,
    mem_pct: f64,
}

impl MonitorScreen {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        let mem_total = sys.total_memory();
        let mem_used = mem_total - sys.available_memory();
        let mem_pct = if mem_total > 0 {
            mem_used as f64 / mem_total as f64 * 100.0
        } else {
            0.0
        };

        Self {
            cpu_pct: sys.global_cpu_usage() as f64,
            mem_total,
            mem_used,
            mem_pct,
            last_poll: Instant::now(),
            sys,
            disks: Disks::new_with_refreshed_list(),
            networks: Networks::new_with_refreshed_list(),
        }
    }
}

impl Screen for MonitorScreen {
    fn update(&mut self) {
        if self.last_poll.elapsed().as_secs_f64() < 2.0 {
            return;
        }
        self.last_poll = Instant::now();
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();

        self.cpu_pct = self.sys.global_cpu_usage() as f64;
        self.mem_total = self.sys.total_memory();
        self.mem_used = self.mem_total - self.sys.available_memory();
        self.mem_pct = if self.mem_total > 0 {
            self.mem_used as f64 / self.mem_total as f64 * 100.0
        } else {
            0.0
        };
    }

    fn render(&mut self, f: &mut Frame) {
        let area = f.area();

        let title = Paragraph::new(" 📊 性能监控").style(
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        );
        f.render_widget(title, Rect::new(area.x, area.y, area.width, 1));

        let mut y = area.y + 2;
        let line_height = 1;

        // 系统内存条
        let (mem_filled, mem_empty) = bar_chars(self.mem_pct, BAR_WIDTH);
        let mem_line = format!(
            " 系统内存 {}{} {}%  {}/{}",
            mem_filled,
            mem_empty,
            self.mem_pct.round() as u64,
            fmt_mem(self.mem_used),
            fmt_mem(self.mem_total)
        );
        f.render_widget(
            Paragraph::new(Line::from(Span::styled(
                &mem_line,
                Style::default().fg(pct_color(self.mem_pct)),
            ))),
            Rect::new(area.x, y, area.width, line_height),
        );
        y += 1;

        // 系统 CPU 条
        let (cpu_filled, cpu_empty) = bar_chars(self.cpu_pct, BAR_WIDTH);
        let cpu_line = format!(
            " 系统CPU  {}{} {}%",
            cpu_filled,
            cpu_empty,
            self.cpu_pct.round() as u64
        );
        f.render_widget(
            Paragraph::new(Line::from(Span::styled(
                &cpu_line,
                Style::default().fg(pct_color(self.cpu_pct)),
            ))),
            Rect::new(area.x, y, area.width, line_height),
        );
        y += 1;

        // 进程信息摘要
        let proc_count = self.sys.processes().len();
        let cpu_count = self.sys.cpus().len();
        let summary = format!(
            " 进程: {}  |  CPU核心: {}  |  已运行: 0s",
            proc_count, cpu_count
        );
        f.render_widget(
            Paragraph::new(Line::from(Span::styled(
                &summary,
                Style::default().fg(Color::DarkGray),
            ))),
            Rect::new(area.x, y, area.width, line_height),
        );
        y += 2;

        // 帮助信息
        f.render_widget(
            Paragraph::new(Line::from(Span::styled(
                " Tab:切换  q:退出  ↑↓:导航",
                Style::default().fg(Color::DarkGray),
            ))),
            Rect::new(area.x, y, area.width, line_height),
        );
    }
}
