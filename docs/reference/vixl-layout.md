---
title: ".vixl layout"
description: Personal Vixl config lives under app data in .vixl and project config lives in the repo .vixl; keys stay in the OS keychain.
---

# .vixl layout

Vixl keeps two config trees. API keys are in the OS keychain, not in either tree. Path resolution lives in `src-tauri/src/commands/paths.rs`. The [Tauri](https://v2.tauri.app/) bundle identifier is `app.vixl`.

## Personal directory

Personal config is `{appData}/.vixl`, created if missing. `appData` is Tauri `app_data_dir()`:

- macOS: `~/Library/Application Support/app.vixl/.vixl`
- Linux: `$XDG_DATA_HOME/app.vixl/.vixl` (usually `~/.local/share/app.vixl/.vixl`)
- Windows: `%APPDATA%\app.vixl\.vixl`

| Path | What |
| --- | --- |
| `settings.json` | Theme, models, provider refs, permissions, MCP trust, sandbox, auto-title, workbench duplicate-tab, workspace trust, LSP auto-download |
| `mcp.json` | Personal MCP servers |
| `lsp.json` | Language server install and disable state (personal only) |
| `vixl.sqlite` | Chats, messages, pins, usage, workbench session |
| `chats/<projectSlug>/<chatId>/` | Per-chat directory (file checkpoints under `file-checkpoints`) |
| `projects.json` | Fleet registry |
| `active-project.json` | Last active project id |
| `graphs/` | Per-project CodeGraph stores, keyed by SHA-256 of the canonical root |
| `agents/` | Personal custom agents (`{slug}.md`) |
| `skills/` | Personal skills (`{slug}/SKILL.md`) |
| `plans/` | Personal plans (`{id}/PLAN.md`) |
| `rules/` | Personal rules (Settings only; not injected into project chats) |
| `AGENTS.md` | Personal always-on instructions for home chats (`agents.md` is accepted if uppercase is missing) |

Home chats use slug `_home_` and the user home directory as workspace.

JSON writes are allowed only under the personal `.vixl` or any path with a `.vixl` ancestor. Parent `..` is rejected.

## Project directory

Project config is `<repo>/.vixl`. Resolution:

1. Use `{root}/.vixl` if that directory exists (even skills-only, no `settings.json`).
2. Else walk up to 8 parents.
3. Stop at `$HOME` / `%USERPROFILE%`.
4. Never select `{home}/.vixl`.
5. Fall back to `{root}/.vixl` if no ancestor `.vixl` is found (it may not exist yet).

Adding a project does not create this folder. It appears when config is first written.

`has_project_vixl` is true only if the resolved dir exists and contains `mcp.json` or `settings.json`. A skills-only `.vixl` still resolves as the project dir.

| Path | What |
| --- | --- |
| `settings.json` | Overrides except `providers.*`, `models.*`, `lsp.*` |
| `mcp.json` | Project MCP servers (same-id override) |
| `agents/` | Project custom agents |
| `skills/` | Project skills |
| `plans/` | Project plans |
| `rules/` | Project rules (injected into project chats) |
| `AGENTS.md` | Project always-on instructions for project chats |

The project tree is committable. Removing a project from the sidebar drops the fleet row only. It does not delete `<repo>/.vixl`, chats, or graph indexes.

## SQLite

`vixl.sqlite` is always under the personal directory. Deleting a chat deletes the `chats` row (messages, usage, and related rows cascade) and removes `chats/<slug>/<id>/`. See [Privacy](/resources/privacy).

## Linux secrets file

If Linux has no Secret Service, secrets fall back to `secrets-vault.json` in the Tauri app config dir (mode `0600`), not inside `.vixl`. macOS and Windows use the OS keychain service `vixl`, account `vixl:vault`.

See [The .vixl directory](/concepts/the-vixl-directory), [settings.json](/reference/settings-json), and [mcp.json](/reference/mcp-json).
