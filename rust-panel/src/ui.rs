use crate::app::{App, Tab};
use crate::screen::screen_svc::render_svc_screen;
use crate::screen::Screen;
use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub fn render(f: &mut Frame, app: &mut App) {
    let area = f.area();
    let chunks = Layout::vertical([Constraint::Length(1), Constraint::Min(1)]).split(area);

    app.services.poll();
    render_tab_bar(f, chunks[0], app);

    match app.active_tab {
        Tab::Dashboard => app.dashboard.render(f),
        Tab::Monitor => app.monitor.render(f),
        Tab::Services => render_svc_screen(f, &app.services, &mut app.svc_screen),
    }
}

fn render_tab_bar(f: &mut Frame, area: Rect, app: &App) {
    let tabs = [
        (" 总览 ", Tab::Dashboard),
        (" 监控 ", Tab::Monitor),
        (" 服务 ", Tab::Services),
    ];

    let tab_widths: Vec<Constraint> = tabs.iter().map(|_| Constraint::Length(10)).collect();
    let chunk = Layout::horizontal(tab_widths).split(area);

    for (i, (label, tab)) in tabs.iter().enumerate() {
        let active = matches!(&app.active_tab, t if std::mem::discriminant(t) == std::mem::discriminant(tab));
        let style = if active {
            Style::default()
                .fg(Color::Black)
                .bg(Color::Cyan)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Color::DarkGray)
        };
        let p = Paragraph::new(Line::from(Span::styled(*label, style)));
        f.render_widget(p, chunk[i]);
    }
}
