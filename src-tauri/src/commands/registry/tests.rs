use std::fs;
use std::path::PathBuf;

use uuid::Uuid;

use super::{normalize_root_path, unique_project_slug, upsert_fleet_project, FleetProject};

struct TempRoot {
    path: PathBuf,
}

impl TempRoot {
    fn new(label: &str) -> Self {
        let path = std::env::temp_dir().join(format!("vixl-registry-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("temp registry root");
        Self { path }
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn sample(id: &str, name: &str, slug: &str, root: &str) -> FleetProject {
    FleetProject {
        id: id.to_string(),
        name: name.to_string(),
        slug: slug.to_string(),
        root_path: root.to_string(),
        last_opened: "1".to_string(),
    }
}

#[test]
fn unique_slug_appends_number_when_taken() {
    let existing = vec![sample("1", "Game", "game", "/tmp/game-a")];
    assert_eq!(unique_project_slug("Game", &existing), "game-2");
    let both = vec![
        sample("1", "Game", "game", "/tmp/game-a"),
        sample("2", "Game", "game-2", "/tmp/game-b"),
    ];
    assert_eq!(unique_project_slug("Game", &both), "game-3");
}

#[test]
fn unique_slug_does_not_emit_reserved_home() {
    assert_ne!(unique_project_slug("_home_", &[]), "_home_");
    let existing = vec![sample("1", "Home", "_home_", "/tmp/home")];
    assert_ne!(unique_project_slug("home", &existing), "_home_");
}

#[test]
fn upsert_existing_reuses_id_slug_and_name() {
    let root = TempRoot::new("existing");
    let root_str = root.path.to_string_lossy().to_string();
    let mut projects = Vec::new();
    let created = upsert_fleet_project(&mut projects, "Game".to_string(), root_str.clone());
    let dotted = root.path.join(".");
    let again = upsert_fleet_project(
        &mut projects,
        "Other Name".to_string(),
        dotted.to_string_lossy().to_string(),
    );
    assert_eq!(projects.len(), 1);
    assert_eq!(again.id, created.id);
    assert_eq!(again.slug, created.slug);
    assert_eq!(again.name, "Game");
    assert_eq!(again.slug, "game");
}

#[test]
fn upsert_create_new_assigns_unique_slug() {
    let first_root = TempRoot::new("game-a");
    let second_root = TempRoot::new("game-b");
    let mut projects = Vec::new();
    let first = upsert_fleet_project(
        &mut projects,
        "Game".to_string(),
        first_root.path.to_string_lossy().to_string(),
    );
    let second = upsert_fleet_project(
        &mut projects,
        "Game".to_string(),
        second_root.path.to_string_lossy().to_string(),
    );
    assert_ne!(first.id, second.id);
    assert_eq!(first.slug, "game");
    assert_eq!(second.slug, "game-2");
    assert_eq!(projects.len(), 2);
}

#[test]
fn normalize_root_path_strips_trailing_slash() {
    let root = TempRoot::new("slash");
    let with_slash = format!("{}{}", root.path.display(), std::path::MAIN_SEPARATOR);
    let normalized = normalize_root_path(with_slash);
    assert!(
        !normalized.ends_with('/') && !normalized.ends_with('\\'),
        "normalized path should not end with a slash: {normalized}"
    );
}

#[cfg(windows)]
#[test]
fn normalize_root_path_drops_windows_verbatim_prefix() {
    let root = TempRoot::new("verbatim");
    let normalized = normalize_root_path(root.path.to_string_lossy().to_string());
    assert!(
        !normalized.starts_with(r"\\?\"),
        "normalized path should not use a verbatim prefix: {normalized}"
    );
}
