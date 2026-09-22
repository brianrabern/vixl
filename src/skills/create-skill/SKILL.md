---
name: create-skill
description: Write a project skill as SKILL.md.
---

# Create skill

Write a project skill with `write_file`.

## Constraints

- If name or purpose is missing, `ask_user`. Do not invent a vague file.
- Project chat: write `.vixl/skills/{slug}/SKILL.md`. Slug is slugify of the name (`lower`, `strict`), fallback `untitled`.
- Home chat: the workspace root is the user home directory. Write the same relative path with `write_file` (`.vixl/skills/{slug}/SKILL.md`). That is the home workspace `.vixl`, not an ancestor of some other project. Do not refuse. Do not send the user to Settings.
- If `write_file` is unavailable, stop and say to switch to Agent mode.
- Reject slugs `ask`, `plan`, `agent`, `orchestrator`.
- Also reject command slugs `create-agent`, `create-skill`, `create-rule`, `create-plan`.

## File

Required frontmatter: `name` and `description` as JSON strings. Description says what the skill does and when to load it.

Body is the procedure. Keep the written body under 4000 characters (loaders truncate past that).

## Example

```markdown
---
name: "deploy"
description: "Ship the app when the user asks to deploy"
---

Steps to deploy this repo.
```
