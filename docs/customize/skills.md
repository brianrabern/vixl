---
title: Skills
description: A Vixl skill is a SKILL.md file; agents see a catalog, load full text with load_skill, and you can attach one with /.
---

# Skills

Create skills from Settings > Skills or the project Skills tab with the New skill sheet. A skill is a `SKILL.md` file: YAML frontmatter plus a markdown body. Agents see a catalog, can load the full text with `load_skill`, and you can attach one from the [chat input](/getting-started/your-first-chat) with `/`.

Usage-level format (name and description required):

```markdown
---
name: "deploy"
description: "Ship the app"
---

Steps to deploy this repo.
```

The create form JSON-stringifies name and description. The body is free markdown. Loaders strip frontmatter and inject the body. Bodies over 4000 characters are truncated when loaded. Full field spec: [SKILL.md format](/reference/skill-md-format).

## Personal vs project

- Personal: Settings > Skills. Files: `{appData}/.vixl/skills/{slug}/SKILL.md`.
- Project: project Skills tab. Files: `<repo>/.vixl/skills/{slug}/SKILL.md`.

**New skill** opens a sheet: Name, Description, Body. Create writes the file. Click a row to open it in the workbench editor. Reveal in folder creates `skills/` if needed.

Home chats: personal skills only (slash index). Project chats: personal plus project. Same name, case-insensitive: project wins in the catalog. Loading by name tries built-in first, then project, then personal.

## How agents discover skills

`/` on the chat input lists user and project skills (and [custom agents](/customize/custom-agents)). Placeholder: `@ for context, / for commands`. Reserved slash names cannot run via `/`: `ask`, `plan`, `agent`, `orchestrator`.

Selecting a skill inserts a mention. On send, that becomes a `Skill {name}` block in the prompt. Agents can also call `load_skill` with the skill name, without a `/` mention.

Project chats include an `Available skills:` list in the system prompt (`name: description`). The matching built-in mode skill is inlined for that [chat mode](/concepts/chat-modes), then omitted from the list.

Built-in skills ship with the app. `agent` inlines in Agent mode (implement end to end, prefer write tools, no commit unless asked). `ask` inlines in Ask mode (read-only, no file or git mutations). `plan` inlines in Plan mode (research and write `PLAN.md`, no source mutations). `orchestrator` inlines in Orchestrator mode (coordinate sub-agents; the parent does not mutate files or shell). Those four are gated to their mode and hidden from `/`.

See [Context](/concepts/context) and [the `.vixl` directory](/concepts/the-vixl-directory). Next: [Custom agents](/customize/custom-agents).
