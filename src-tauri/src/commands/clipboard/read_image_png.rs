use tauri::ipc::Response;
use tauri::AppHandle;

pub const NO_CLIPBOARD_IMAGE: &str = "clipboard has no image";

#[cfg(not(target_os = "macos"))]
fn is_missing_clipboard_image(message: &str) -> bool {
    message.contains("not available in the requested format")
        || message.contains("clipboard is empty")
}

#[cfg(not(target_os = "macos"))]
fn read_via_arboard(app: AppHandle) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    use tauri_plugin_clipboard_manager::ClipboardExt;

    let clipboard_image = app.clipboard().read_image().map_err(|error| {
        let message = error.to_string();
        if is_missing_clipboard_image(&message) {
            NO_CLIPBOARD_IMAGE.to_string()
        } else {
            message
        }
    })?;

    let rgba = clipboard_image.rgba().to_vec();
    let width = clipboard_image.width();
    let height = clipboard_image.height();
    let buffer = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "clipboard image has invalid dimensions".to_string())?;

    let mut png = Cursor::new(Vec::new());
    buffer
        .write_to(&mut png, image::ImageFormat::Png)
        .map_err(|error| format!("Failed to encode clipboard image as PNG: {error}"))?;

    Ok(png.into_inner())
}

#[cfg(target_os = "macos")]
async fn read_via_macos(app: AppHandle) -> Result<Vec<u8>, String> {
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(super::macos::read_png_bytes());
    })
    .map_err(|error| format!("Failed to read clipboard on the main thread: {error}"))?;

    rx.await
        .map_err(|_| "Failed to read clipboard on the main thread".to_string())?
}

#[tauri::command]
pub async fn read_clipboard_image_png(app: AppHandle) -> Result<Response, String> {
    #[cfg(target_os = "macos")]
    let png = read_via_macos(app).await?;

    #[cfg(not(target_os = "macos"))]
    let png = read_via_arboard(app)?;

    Ok(Response::new(png))
}
