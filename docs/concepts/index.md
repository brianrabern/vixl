---
title: How Vixl works
---

# How Vixl works

Vixl is a desktop LLMs UI that supports agents and coding. The UI is [Vue](https://vuejs.org/). The shell is [Tauri](https://tauri.app/). The backend is [Rust](https://www.rust-lang.org/). The agent runs on your machine. There is no Vixl home server, and the app does not ship analytics.

The only network calls are the ones you configure: model providers, [MCP](https://modelcontextprotocol.io/) servers, and updates from [GitHub Releases](https://github.com/vixl-ai/vixl/releases).

## Where state lives

API keys and MCP secrets go in the OS keychain (service `vixl`, vault account `vixl:vault`). On Linux, if Secret Service is missing or locked, Vixl falls back to `secrets-vault.json` in the Tauri config directory, mode `0600`. Keys must start with `vixl:`. Provider keys use `vixl:provider:<ref>`. They are never written to `.vixl` JSON.

Chats, messages, usage, and workbench tabs live in [SQLite](https://www.sqlite.org/) at `vixl.sqlite` under the personal `.vixl` directory. Each chat also has a directory at `.vixl/chats/<projectSlug>/<chatId>/`. Deleting a chat drops the SQLite rows and that directory.

Settings, MCP configs, plans, skills, agents, rules, and `AGENTS.md` live in `.vixl` trees. Personal config is `{app data}/.vixl`, where the app data directory comes from Tauri with identifier `app.vixl`. On macOS that is `~/Library/Application Support/app.vixl/.vixl`. Project config is `<repo>/.vixl` and can be committed.

The fleet of registered folders is `projects.json` and `active-project.json` in personal `.vixl`. Code graph indexes live under personal `.vixl/graphs/`, not in the repo.

See [The .vixl directory](/concepts/the-vixl-directory) for paths and merge rules, and [Privacy](/resources/privacy) for what delete covers.

## Local-first harness

The Vue UI talks to the local Tauri/Rust process. That process owns the filesystem, PTY, [git](https://git-scm.com/), MCP stdio, keychain, and SQLite. There is no remote Vixl API. The UI is for you. Built-in prompts are harness awareness, not a persona.

Context is assembled per turn: a small base prompt, the mode skill, then catalogs and mentions. Full MCP schemas and skill bodies load on demand. That is [progressive tool discovery](/concepts/context), and it is why local prefills stay smaller than harnesses that dump every tool schema up front.

[Chat modes](/concepts/chat-modes) decide which tools exist at all. [Permissions and approvals](/concepts/permissions-and-approvals) decide which of those tools may run without asking.

[Set up providers and models](/getting-started/set-up-providers-and-models) if you have not added a provider yet. [Your first chat](/getting-started/your-first-chat) walks through sending a message.
