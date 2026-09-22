---
name: create-rule
description: Write a project rule under .vixl/rules.
---

# Create rule

Write a project rule with `write_file`.

## Constraints

- If name or purpose is missing, `ask_user`. Do not invent a vague file.
- Project chat: write `.vixl/rules/{slug}.md`. Slug is slugify of the name (`lower`, `strict`), fallback `untitled`.
- Home chat: the workspace root is the user home directory. Write the same relative path with `write_file` (`.vixl/rules/{slug}.md`). That is the home workspace `.vixl`, not an ancestor of some other project. Do not refuse. Do not send the user to Settings.
- If `write_file` is unavailable, stop and say to switch to Agent mode.
- Reject slugs `ask`, `plan`, `agent`, `orchestrator`.

## File

No frontmatter. The whole file is injected into project chats. There is no glob gate, so keep the rule short and specific.

Home chats do not inject `.vixl/rules` into the prompt. They inject `.vixl/AGENTS.md` only. Still write the rule file when the user asked for a rule. If they asked for always-on home guidance, write `.vixl/AGENTS.md` instead. Starter:

```markdown
# Project instructions

Add repository-specific guidance for the agent here.
```

## Example

```markdown
Prefer write_file and edit_file over shell redirects. Do not commit unless the user asks.
```
