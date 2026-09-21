---
title: Permissions and approvals
description: The Vixl permission dial is Ask, Allowlist, or Bypass, and it decides which tools may run without asking you.
---

# Permissions and approvals

The shield under the chat input is the permission dial: Ask, Allowlist, Bypass. The default is Allowlist (`agent.permissionLevel`). On a live thread, changing the dial also writes that personal setting.

Mode allowlists decide which tools exist. This dial decides whether a tool that wants to write, run shell, touch git, fetch the web, or call [MCP](https://modelcontextprotocol.io/) may proceed without asking you.

## Dial levels

Ask prompts before each write, shell, git, web, or MCP action.

Allowlist auto-approves filesystem writes and deletes whose paths all match `agent.autoApproveGlobs` in `settings.json`. Everything else asks. Those globs also auto-approve matching filesystem writes when the dial is Ask. There is no Settings form for the glob list. Empty list means every matching action asks.

Bypass skips prompts for file, shell, git, web, and MCP. Switching to Bypass opens **Enable bypass mode?** with Cancel and Enable bypass. Sensitive paths still ask. Denied capabilities still deny. `move_workspace` still asks, once only.

## Approval scopes

When Vixl asks, the card offers scopes the policy allows:

- Allow once (or **Run outside sandbox** when the command is unsandboxed)
- Allow session
- Allow workspace (filesystem prefers this first: **Allow file edits in this workspace**)
- Always allow
- Deny
- Never

Once applies to this call. Session lasts for the rest of the stream. Workspace writes `agent.permissions` on the project's `settings.json`. Always writes the same key on personal `settings.json`. Never is a session deny plus a persisted deny.

Home chats have no project, so workspace persist is refused.

Shell, including network and unsandboxed hops, only offers once, session, and never. Those records do not persist as workspace or always. Approving once for `shell.network` or `shell.unsandboxed` is sticky onto the session. A session allow of `shell` does not cover network or unsandboxed. A session allow of `shell.unsandboxed` covers network and sandboxed shell.

`move_workspace` is once only. Bypass does not auto-allow it.

## What still asks

Policy order is deny first (session or persisted), then the action-specific rules.

Sensitive paths always ask, including under Bypass: `.env`, `.ssh`, `.aws`, `.gnupg`, `.netrc`, `.npmrc`, `.pypirc`, kube and docker config, private keys, names that match credential, secret, or password, and suffixes `.pem`, `.key`, `.p12`, `.pfx`, `.jks`.

OS sandbox is separate from the dial. **Sandbox terminal** (default on) lets sandboxed commands auto-run. Leaving the sandbox always asks. **Sandbox network** is Deny or Allow (default Allow). Review both in [Permission settings](/customize/permission-settings).

MCP trust is also separate. An untrusted server cannot start or be called, even in Bypass. Trust choices are This session, This workspace, Always, Never. Changing the command, args, or URL requires trust again. Personal `never` wins the merge.

## Git neutrality

Vixl has [git](https://git-scm.com/) tools and will ask (or Bypass-allow) `git.write`. Built-in prompts never tell the agent to commit, branch, or follow a git flow, and commits do not add Vixl or the model as a co-author. If the model is a tool, it was not a co-author. The harness is not either.

Persisted allow and deny rows show up in Settings > Permissions, grouped as Filesystem, Shell, Git, MCP, Web. You can remove one row or **Clear all**. You cannot add rows there. They appear after you approve or deny in chat.

[Chat modes](/concepts/chat-modes) sit under this gate. [Permission settings](/customize/permission-settings) is the Settings surface.
