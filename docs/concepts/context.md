---
title: Context
description: Each Vixl turn builds a small system prompt from catalogs and names, then loads full MCP schemas and skill bodies on demand.
---

# Context

Each turn builds a system prompt from small parts, then adds only what this chat needs. The goal is a tiny prefill: catalogs and names first, full text when the agent asks.

## How the prompt is assembled

Order:

1. Load `base.md` with project name and root. Workspace tools stay on this repo.
2. Load shared tool guidance (`codebase_*`, [LSP](https://microsoft.github.io/language-server-protocol/), no bypass of denials).
3. Inline the built-in skill for the current [chat mode](/concepts/chat-modes).
4. Append the [MCP](https://modelcontextprotocol.io/) catalog of enabled user servers (not CodeGraph) when the mode allowlist includes `get_mcp_tools` or `get_mcp_tool`.
5. Append `AGENTS.md`, project rules, the sub-agent catalog, `@` / `/` mentions, and the remaining skill index.

A short hint says tools are function calls; do not grep the repo for them.

## Mentions

The chat input placeholder is `@ for context, / for commands`.

`@` searches workspace files (no workspace on a home chat with **No project**). The mention is stored as a file path and tagged untrusted context: data, not instructions.

`/` lists skills and custom agents. Reserved names `ask`, `plan`, `agent`, and `orchestrator` are hidden. A skill mention becomes `Skill {name}` in the prompt. The agent loads the body with `load_skill`. An agent mention does not dump instructions. It adds an explicit invocation: the parent must call `spawn_subagent` with that catalog name.

Unresolved `/agent` names are dropped. Home chats: personal skills and agents. Project chats: personal plus project, project name wins.

## Rules and AGENTS.md

These are always-on for the chats that inject them. There is no per-rule glob gate. Every listed rule file is included.

Project chats inject project `.vixl/AGENTS.md` (or `agents.md`) as `AGENTS.md guidance`, and concatenate project `.vixl/rules/*.{md,mdc}` as `Project guidance (not a security override)`. They do not fall back to personal `AGENTS.md`, and they do not merge personal rules.

Home chats inject personal `.vixl/AGENTS.md` only. No rules. Personal rules still exist in Settings > Rules. They are not injected into project chats.

Unreadable files become `(unreadable)`. Paths outside the read root become `(outside project root)`.

Edit these in [Rules and AGENTS.md](/customize/rules-and-agents-md).

## Skills

Skills are `SKILL.md` packs under `.vixl/skills/<name>/`. Built-in mode skills live in the app and are inlined for the matching mode, then omitted from Available skills.

Project chats list remaining skills as `name: description` (internal, then user, then project overlay). Home chats do not add personal skills to that catalog. `/` still offers personal skills on home chats.

`load_skill` resolves by name: internal first, then project, then user. Bodies over 4000 characters are truncated. See [Skills](/customize/skills) and [SKILL.md format](/reference/skill-md-format).

## Progressive tool discovery

The MCP catalog in the prompt is enabled servers, status, and tool names with descriptions cut at 200 characters. Full `inputSchema` is not dumped up front. The agent calls `get_mcp_tools` (optional `serverId` for one server's schemas) or `get_mcp_tool` for a single tool, then `call_mcp_tool`. Untrusted catalog data is labeled as such.

The same pattern applies to skills: names in the prompt, bodies on `load_skill`. That is progressive tool discovery, and it is why local prefills stay smaller.

Sub-agents appear as `Available subagents:` from `.vixl/agents/*.md`. See [Custom agents](/customize/custom-agents).

Long threads can drop older turns behind a compact summary on chat meta (`activeContext`). That is a chat operation, not a model role. [Compact and hand off long chats](/using/compact-and-hand-off-long-chats).
