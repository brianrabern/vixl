---
title: Models
---

# Models

Model picks are personal. Settings > Models writes `models.*` in the user [`.vixl` `settings.json`](/reference/settings-json). Project folders cannot override them. Runtime still reads the provider key from the [OS keychain](/customize/providers).

Until a provider exists, the section is blocked: "Configure at least one provider before choosing models." The [chat input](/getting-started/your-first-chat) picker is disabled in the same case and offers **Add a provider**. Send requires a model.

Saved values are `providerId::modelId`. Pick a model to persist it.

## Role defaults

Each role has a picker. Roles other than Default can fall back to Default. **Use default** clears that role and its reasoning override.

Default (`models.default`) is the fallback for every other role. Placeholder: "Select default model". Ask (`models.ask`) is [Ask mode](/concepts/chat-modes). Plan (`models.plan`) is Plan mode. Agent (`models.agent`) is Agent mode and single-agent plan runs. Orchestrator (`models.orchestrator`) is Orchestrator mode and plan orchestration, with nested pickers **Parent** and **Subagent**. Subagent (`models.subagent`) is nested `spawn_subagent` runs when an [agent file](/customize/custom-agents) does not set its own model; unset falls back to Agent, then Default. Title (`models.title`) generates short titles for new chats.

Title also has an **Auto-title** switch (`chat.autoTitle`, default on). Off disables the Title picker. If Title is still using Default, an amber warning asks you to prefer a small, low-cost model for that background task.

Resolution order (no chat override): the role's own setting if set; for Subagent, then Agent, then Default; for chat modes and Title, Default. A per-chat picker override wins when present.

See [Models and roles](/concepts/models-and-roles) for how modes consume these defaults.

## Add models

Catalog providers list live `/models` from that endpoint (Ollama and LM Studio use their default base URLs). You do not maintain a static model list for those.

For a [custom OpenAI-compatible](/customize/providers) provider, the manage dialog can:

1. Import from `/models`.
2. Add a model row (id, display name, context, max in/out, Tools / Vision / Thinking / Stream, pricing).
3. Keep the list empty for live `/models` listing.

A row you added without pricing shows an amber warning.

## Per-model options

The picker extras panel (`models.catalogOptions`) can set Allowed in chat, Fast (when the model supports it), Reasoning (when supported: Default, None, Minimal, Low, Medium, High, Extra high, Max), Context window, and Max output.

Plans that start a chat still need a resolved Agent or Default model in Settings.

Next: [MCP servers](/customize/mcp-servers), or back to [Set up providers and models](/getting-started/set-up-providers-and-models).
