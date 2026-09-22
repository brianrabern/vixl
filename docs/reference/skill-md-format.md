---
title: SKILL.md format
description: A Vixl skill is a folder with SKILL.md YAML name and description plus a markdown body the agent can load.
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

Load by name (case-insensitive): internal first, then project, then user. Catalog merge for `/` and the available-skills list: vendored command skills first, then user, then project overlay (project wins over user). On a home chat, `/` lists vendored command skills, personal skills, and skills under the home workspace `.vixl`. Available skills lists vendored commands and home-workspace skills. It does not add personal skills.

`/create-agent`, `/create-skill`, `/create-rule`, and `/create-plan` are vendored command skills. They are listed in `/` and in Available skills. They work on home chats. The workspace root is the user home directory. The agent writes the same relative `.vixl/` paths there with `write_file` (or `create_plan` for plans). The agent loads them with `load_skill`. A same-named user or project skill cannot override them: the slash index and catalog keep the vendored command, and `load_skill` already prefers internal.

Reserved slash names cannot run via `/`: `ask`, `plan`, `agent`, `orchestrator`. Those are [chat modes](/concepts/chat-modes). Mode skills stay hidden from `/` and stay inlined only in their matching chat mode, then omitted from Available skills.

| Mode skill | When inlined |
| --- | --- |
| `ask` | Ask mode |
| `plan` | Plan mode |
| `agent` | Agent mode |
| `orchestrator` | Orchestrator mode |

Selecting `/` inserts a skill mention. The agent loads the full text with `load_skill`. Missing name, unknown name, and catalog load failures return errors.

See [Context](/concepts/context) and [Custom agent frontmatter](/reference/custom-agent-frontmatter).
