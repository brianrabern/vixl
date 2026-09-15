use std::sync::mpsc;

#[tauri::command]
pub fn set_window_vibrancy(
    window: tauri::WebviewWindow,
    dark: bool,
    hue: Option<f64>,
    intensity: Option<f64>,
) {
    let (tx, rx) = mpsc::channel::<()>();
    super::apply_platform_vibrancy(&window, dark, hue, intensity, tx);
    let _ = rx.recv();
}

#[tauri::command]
pub fn clear_window_vibrancy(window: tauri::WebviewWindow) {
    super::clear_platform_vibrancy(&window);
}
