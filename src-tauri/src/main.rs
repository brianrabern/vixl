// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run_with_launch_path(app_lib::parse_launch_path_arg(std::env::args()));
}
