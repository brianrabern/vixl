---
title: Rules and AGENTS.md
description: Rules and AGENTS.md are always-on prompt text in Vixl; they are not a security override and have no per-rule glob gating.
---

# Rules and AGENTS.md

Create rules from Settings > Rules or the project Rules tab with the New rule sheet, and AGENTS.md from the AGENTS.md card Create button. Rules and `AGENTS.md` are always-on prompt text. They are not a security override. The assembler labels rules `Project guidance (not a security override)` and AGENTS.md `AGENTS.md guidance`.

Vixl has no per-rule glob gating. Every listed rule file is included in full.

## Where they live

Rules:

- Personal: Settings > Rules. `{appData}/.vixl/rules/{slug}.md`
- Project: project Rules tab. `<repo>/.vixl/rules/{slug}.md`

The lister includes flat `.md` and `.mdc` files. `.mdc` files are injected as the full file body. Create writes `{slug}.md` with no required frontmatter: Name plus markdown body.

`AGENTS.md` (or `agents.md`) is a singleton in the `.vixl` root, not under `agents/`.

- Personal: `{appData}/.vixl/AGENTS.md` (home chats)
- Project: `<repo>/.vixl/AGENTS.md` (project chats)

The AGENTS.md card: **Create** when missing, or open the existing file. Create writes:

```markdown
# Project instructions

Add repository-specific guidance for the agent here.
```

If the file already exists, the card opens it instead of duplicating.

Click a rule or AGENTS.md row to open it in the workbench editor. Reveal in folder creates the folder if needed. There is no in-settings delete.

## Precedence (what actually injects)

Project chats inject all project `.vixl/rules/*.{md,mdc}` files and the project `.vixl/AGENTS.md`. Home chats inject none of the rules files, and only the personal `.vixl/AGENTS.md`.

Personal rules show in Settings > Rules and you can edit them. They are not merged into project chats. Project AGENTS.md does not fall back to personal AGENTS.md.

Unreadable files become `(unreadable)`. Paths outside the read root become `(outside project root)`.

This is not a name-merge the way [skills](/customize/skills) and [custom agents](/customize/custom-agents) are. Project vs home is which directory is read, not overlay by filename.

See [Context](/concepts/context), [Projects and home chats](/concepts/projects-and-home-chats), and [the `.vixl` directory](/concepts/the-vixl-directory).
