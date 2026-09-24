pub(crate) const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".next",
    ".nuxt",
    "coverage",
    "out",
    ".output",
    "vendor",
    ".venv",
    "venv",
    "__pycache__",
    ".vixl",
    ".cache",
    ".turbo",
    ".pnpm-store",
];

pub(crate) fn skip_directory(name: &str) -> bool {
    if SKIP_DIRS.contains(&name) {
        return true;
    }
    name.starts_with('.') && name != ".github"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_high_churn_and_hidden_dirs() {
        assert!(skip_directory("node_modules"));
        assert!(skip_directory(".git"));
        assert!(skip_directory(".vscode"));
        assert!(skip_directory("target"));
        assert!(!skip_directory("src"));
        assert!(!skip_directory(".github"));
    }
}
