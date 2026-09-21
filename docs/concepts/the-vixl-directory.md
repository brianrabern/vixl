---
title: The .vixl directory
description: Vixl keeps personal and project .vixl trees for config, while API keys and MCP secrets stay in the OS keychain.
---

# The .vixl directory

Vixl keeps two config trees. API keys and [MCP](https://modelcontextprotocol.io/) secrets are in the OS keychain, not in either tree. See [How Vixl works](/concepts/) for the keychain.

## Personal vs project

Personal `.vixl` is `{app data}/.vixl`. The app data directory is [Tauri](https://tauri.app)'s `app_data_dir` for identifier `app.vixl`. On macOS: `~/Library/Application Support/app.vixl/.vixl`. The directory is created if missing.

Project `.vixl` is resolved from the opened folder:

1. Keep `{root}/.vixl` when that directory exists (even skills-only, with no `settings.json`).
2. Walk up to 8 parent folders, stopping at `$HOME` (excluding `{home}/.vixl`).
3. Fall back to `{root}/.vixl` if no ancestor `.vixl` is found (it may not exist yet).

`has_project_vixl` is true only when the resolved directory exists and contains `mcp.json` or `settings.json`. A skills-only `.vixl` still resolves as the project dir. JSON writes are allowed under personal `.vixl` or any path with a `.vixl` ancestor.

Adding a project does not create `<repo>/.vixl`. It appears when config is first written.

## Personal tree

Under `{app data}/.vixl`, `settings.json` holds theme, models, provider refs, permissions, MCP trust, sandbox, auto-title, workbench duplicate-tab, workspace trust, and LSP auto-download. `mcp.json` is personal MCP servers. `lsp.json` is language server install and disable state (personal only). `vixl.sqlite` is chats, messages, usage, pins, workbench tabs and prefs, and editor view state. `projects.json` and `active-project.json` are the fleet. `graphs/` holds per-project CodeGraph stores. Per-chat files live under `chats/<projectSlug>/<chatId>/`. Personal copies of `agents/`, `skills/`, `plans/`, `rules/`, and `AGENTS.md` live here too.

Home chats use personal `AGENTS.md`. Personal rules are editable in Settings and are not injected into project chats.

## Project tree

Under `<repo>/.vixl` (committable), `settings.json` is project overrides and `mcp.json` is project MCP servers (same id replaces personal). `agents/`, `skills/`, `plans/`, `rules/`, and `AGENTS.md` are the project-scoped copies.

Plans from `create_plan` write `.vixl/plans/<id>/PLAN.md`. Skills are `.vixl/skills/<name>/SKILL.md`. Custom agents are `.vixl/agents/<slug>.md`. Rules are flat `.md` or `.mdc`. `AGENTS.md` sits in the `.vixl` root, not under `agents/`.

## Merge

Effective settings for a project chat are personal `settings.json` plus project `settings.json`. Invalid project JSON becomes empty overrides.

Project overlay wins for most keys. Keys starting `providers.`, `models.`, or `lsp.` are personal only. If they appear in a project file they are stripped and rewritten.

`agent.mcp.trust` unions by `serverId`. Scope `never` beats everything. Otherwise the project record wins.

`agent.permissions` unions by `capability`. Personal `deny` wins. Then project `deny`. Else project.

`agent.autoApproveGlobs` is the union of both string lists.

MCP servers: project `servers[id]` replaces personal `servers[id]`. Inputs merge by id (project wins). The managed CodeGraph id `codegraph` is stripped from user lists.

Skills and custom agents: same name, project wins (case-insensitive). Load-by-name for skills is internal, then project, then user.

Rules and `AGENTS.md` are not a name-merge. Project chats inject project files only. Home chats inject personal `AGENTS.md` and no rules. Details: [Context](/concepts/context).

Home chats load personal settings only (`loadEffectiveSettings` with no project overlay).

[settings.json](/reference/settings-json) and [.vixl layout](/reference/vixl-layout) are the field-level references. [Customize](/customize/providers) is where you edit these files from the UI.
