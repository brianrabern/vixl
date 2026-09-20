---
title: SKILL.md format
---

# SKILL.md format

A skill is a folder that contains `SKILL.md`:

| Scope | Path |
| --- | --- |
| Personal | `{appData}/.vixl/skills/{slug}/SKILL.md` |
| Project | `<repo>/.vixl/skills/{slug}/SKILL.md` |
| Built-in | bundled from `src/skills/{name}/SKILL.md` |

The list name is the folder name. Description comes from YAML `description`. Create skills from Settings or the project Skills tab. See [Skills](/customize/skills).

## SKILL.md document

```markdown
---
name: "deploy"
description: "Ship the app"
---

Steps to deploy this repo.
```

Frontmatter schema:

| Field | Type | Required |
| --- | --- | --- |
| `name` | string, min length 1 | yes |
| `description` | string, min length 1 | yes |

There are no other frontmatter fields. The create form JSON-stringifies `name` and `description`. Body is free markdown.

Loaders strip frontmatter and inject the body. If the loaded body is longer than 4000 characters, it is truncated and the agent is told characters were omitted.

## How a skill is found

Load by name (case-insensitive): internal first, then project, then user. Catalog merge for `/` and the available-skills list: user, then project overlay (project wins). Home chats see personal skills only.

Reserved slash names cannot run via `/`: `ask`, `plan`, `agent`, `orchestrator`. Those are [chat modes](/concepts/chat-modes). Built-in mode skills are inlined into the system prompt for the matching mode, then omitted from Available skills.

| Built-in skill | When inlined |
| --- | --- |
| `ask` | Ask mode |
| `plan` | Plan mode |
| `agent` | Agent mode |
| `orchestrator` | Orchestrator mode |

Selecting `/` inserts a skill mention. The agent loads the full text with `load_skill`. Missing name, unknown name, and catalog load failures return errors.

See [Context](/concepts/context) and [Custom agent frontmatter](/reference/custom-agent-frontmatter).
