---
title: Permission settings
description: Configure the Vixl permission dial, sandbox, and allow/deny list from the chat input and Settings > Permissions.
---

# Permission settings

Two surfaces. The permission dial sits on the [chat input](/getting-started/your-first-chat). Settings > Permissions holds the sandbox switches and the persisted allow/deny list. See [Permissions and approvals](/concepts/permissions-and-approvals).

Default level is Allowlist (`agent.permissionLevel`). Changing the dial writes that personal setting.

## The dial (Ask, Allowlist, Bypass)

Ask prompts before each write, shell, git, web, or [MCP](https://modelcontextprotocol.io) action. Allowlist auto-approves paths matching `agent.autoApproveGlobs` and asks for the rest. Bypass skips prompts for file, shell, git, web, and MCP actions. Sensitive paths still ask.

Switching to Bypass opens **Enable bypass mode?** Copy: "Bypass mode runs all tool actions without asking. Sensitive paths and denied capabilities still block or ask." Confirm: **Enable bypass**.

Sensitive paths (`.env`, `.ssh`, credential-like names, key files, and similar) always ask. That check wins over persisted allow, session allow, and Bypass.

There is no glob editor in Settings. `agent.autoApproveGlobs` lives in [settings.json](/reference/settings-json) (default empty; personal and project lists union). Matching globs auto-approve `fs.write` / `fs.delete` when every path matches.

## Sandbox

Settings > Permissions has **Sandbox terminal** (`agent.sandbox.enabled`, default on). Sandboxed commands can auto-run. Leaving the sandbox always asks. **Sandbox network** is Deny or Allow (`agent.sandbox.network`, default Allow), disabled when sandbox is off. Network access for sandboxed commands. Allow is the default.

OS sandboxing is separate from the permission gate. Unsandboxed or network hops still go through the dial.

## Allowlists from chat approvals

Settings does not add allow/deny rows. Rows appear after you approve or deny in chat with a persisting scope.

Persisted records (`agent.permissions`) only store `scope: "workspace"` or `scope: "always"` with verdict allow or deny. Groups: Filesystem, Shell, Git, MCP, Web. MCP and some filesystem groups use accordions. Each row: capability label, scope, allow/deny badge, trash.

Remove one row with its trash control. Header trash **Clear all** writes `[]`.

Approval actions in chat include Allow once, Allow session, Allow workspace, Always allow, Deny, and Never. Shell persist scopes are once / session / never only (no workspace or always row for shell). Session and once do not show in Settings.

Personal `deny` wins on merge with project. Then project `deny`. Else project. Project overlay still cannot write `providers.*`, `models.*`, or `lsp.*`.

MCP trust is separate: see [MCP servers](/customize/mcp-servers). Trusted servers still pass `mcp.call` through this dial.
