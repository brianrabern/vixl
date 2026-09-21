---
title: Keyboard shortcuts
description: Vixl app shortcuts include the command palette, New Agent, sidebars, send, and Escape to leave Settings.
---

# Keyboard shortcuts

App shortcuts are registered in source. This list is those bindings only. Monaco and the PTY terminal keep their own editor and shell keys.

| Keys | Action |
| --- | --- |
| Cmd/Ctrl+K | Toggle the command palette |
| Cmd/Ctrl+N | Open Home (New Agent) |
| Cmd/Ctrl+B | Toggle the left sidebar |
| Cmd/Ctrl+Shift+B | Toggle the right workbench |
| Esc | Leave Settings or the project page (go Home) |
| Enter | Send the chat input |
| Shift+Enter | Insert a newline in the chat input |
| Backspace | On an empty chat input with attachments, remove the last file |

Cmd/Ctrl+N and Cmd/Ctrl+Shift+B do nothing while you are typing in an input, textarea, contenteditable, Monaco, or xterm. Cmd/Ctrl+K still opens the palette. Cmd/Ctrl+B is handled by the sidebar provider and is not gated on typing.

Escape on Settings and on a project page navigates to `/`. The in-app shortcut dialog labels Escape as Leave Settings.

The command palette lists New Agent, Open Settings, Open Terminal, Open Editor, projects, chats, pinned chats, and every personal Settings section. See [Shortcuts and the command palette](/using/shortcuts-and-the-command-palette).
