#[cfg(target_os = "macos")]
mod macos;
mod read_image_png;

pub use read_image_png::read_clipboard_image_png;
