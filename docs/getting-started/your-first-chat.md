---
title: Your first chat
description: Send a first Vixl chat from the home screen after you pick a project, a mode, and a BYOK model.
---

# Your first chat

First launch is the home screen: a centered chat input, nothing else. **New Agent** in the sidebar (or `Cmd` or `Ctrl+N`) returns here.

You need a [provider and a model](/getting-started/set-up-providers-and-models) before send. The model control says **Select model**. With no provider it is disabled. Send requires a model.

## Send from home

1. Click **New Agent** if you are not already on home.
2. Select a project. The picker defaults to the last active project, or **No project**.
3. Choose a mode: **Agent**, **Ask**, **Plan**, or **Orchestrator**.
4. Choose a model.
5. Type in the chat input.
6. Send the message.

Enter sends. Shift-Enter inserts a line. Placeholder: `@ for context, / for commands`.

**No project** creates a [home chat](/concepts/projects-and-home-chats) (`_home_`) whose workspace is your user home directory. A selected project creates a project chat and opens that thread. New chats are titled **New Agent** until [Auto-title](/getting-started/set-up-providers-and-models) fills one in (on by default).

The plus menu is **Upload photos or files**. The picker accepts images. The shield under the input is the permission dial: **Ask**, **Allowlist**, or **Bypass**. Default is **Allowlist** unless you changed it in Settings. See [Permissions and approvals](/concepts/permissions-and-approvals).

On a git workspace, a branch control appears under the input. Home with **No project** does not show it.

The [MCP](https://modelcontextprotocol.io/) control lists configured servers. Skills and custom agents are `/` in the editor, not a separate button.

## Four modes

Default on a new chat input is **Agent**. Changing mode does not swap a model you already picked. An empty model field fills from that mode's role.

**Ask** is read-only exploration: no file writes, no git mutations. **Plan** researches, then writes a durable `PLAN.md`, still without source mutations. **Agent** implements changes (files, shell, git tools, MCP, plans, sub-agents). Its skill says not to commit unless asked. **Orchestrator** coordinates through sub-agents. The parent does not mutate files or run shell, except `move_workspace` after a folder or worktree exists.

Tool allowlists and mode skills are on [Chat modes](/concepts/chat-modes).

## After you send

The thread opens and the first message is sent. The agent can read the workspace, call tools the mode allows, and ask before actions the [permission dial](/concepts/permissions-and-approvals) does not already allow. The right sidebar is the [workbench](/using/use-the-workbench): editor, terminals, git, and plan tabs.

While a reply is running, send becomes **Stop generating**.

[Manage chats](/using/manage-chats) covers rename, pin, fork, and delete. Delete is permanent on the client. See [Philosophy](/getting-started/philosophy).
