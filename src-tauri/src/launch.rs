use tauri::{AppHandle, Emitter, Manager};

use crate::commands::{open_project_at_path, resolve_launch_path};

pub fn parse_launch_path_arg(args: impl IntoIterator<Item = String>) -> Option<String> {
    let mut iter = args.into_iter();
    iter.next();
    iter.find(|arg| arg != "--" && !arg.starts_with('-'))
}

pub fn handle_second_instance(app: &AppHandle, args: Vec<String>) {
    if let Some(path_arg) = parse_launch_path_arg(args) {
        match resolve_launch_path(&path_arg) {
            Ok(path) => {
                if let Err(error) = open_project_at_path(app, path) {
                    log::error!("Failed to open CLI project: {error}");
                }
            }
            Err(error) => log::error!("Invalid CLI path: {error}"),
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
            log::error!("Failed to show window: {error}");
        }
        if let Err(error) = window.unminimize() {
            log::error!("Failed to unminimize window: {error}");
        }
        if let Err(error) = window.set_focus() {
            log::error!("Failed to focus window: {error}");
        }
    }

    if let Err(error) = app.emit("vixl-project-opened", ()) {
        log::error!("Failed to emit project opened event: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::parse_launch_path_arg;

    #[test]
    fn skips_flags() {
        let args = vec![
            "vixl".to_string(),
            "--verbose".to_string(),
            "-h".to_string(),
            "/tmp/proj".to_string(),
        ];
        assert_eq!(parse_launch_path_arg(args).as_deref(), Some("/tmp/proj"));
    }

    #[test]
    fn skips_double_dash() {
        let args = vec![
            "vixl".to_string(),
            "--".to_string(),
            "/tmp/proj".to_string(),
        ];
        assert_eq!(parse_launch_path_arg(args).as_deref(), Some("/tmp/proj"));
    }

    #[test]
    fn first_path_wins() {
        let args = vec![
            "vixl".to_string(),
            "/tmp/first".to_string(),
            "/tmp/second".to_string(),
        ];
        assert_eq!(parse_launch_path_arg(args).as_deref(), Some("/tmp/first"));
    }

    #[test]
    fn empty_args_returns_none() {
        assert_eq!(parse_launch_path_arg(Vec::<String>::new()), None);
        assert_eq!(parse_launch_path_arg(vec!["vixl".to_string()]), None);
        assert_eq!(
            parse_launch_path_arg(vec!["vixl".to_string(), "--help".to_string()]),
            None
        );
    }
}
