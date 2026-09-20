---
title: Export a transcript
---

# Export a transcript

Right-click the thread (not the sidebar row) and choose Export Transcript.

Vixl builds a plain-text dump of the current timeline and opens a native [Tauri](https://tauri.app) save dialog. The default filename is the chat title, sanitized, with a `.txt` suffix. The dialog's filter is Text, with extensions `txt` and `md`. Pick a path. Cancel writes nothing.

The text is labeled by turn type:

- USER
- ASSISTANT (reasoning, text, tool runs, trailing text, errors)
- TODO (in-chat task list)
- SUBAGENT (name, status, prompt, nested tools, steers, summary)
- COMPACTION (summary, optional focus)

An empty thread exports `(empty conversation)`.

Copy ID on the same menu copies the chat id to the clipboard. It is not a transcript.

[Manage chats](/using/manage-chats)
