---
title: settings.json
---

# settings.json

Personal settings live at `{appData}/.vixl/settings.json`. Project overrides live at `<repo>/.vixl/settings.json`. API keys are never stored here. They go in the OS keychain. See [The .vixl directory](/concepts/the-vixl-directory) and [Providers](/customize/providers).

The file is a JSON object with `"version": 1`. Missing or invalid files load as the defaults below. Unknown keys that still parse (string, number, boolean, array, or a custom provider object) are kept. Deprecated keys such as `agent.defaultModel` are dropped on migrate.

## Personal vs project

Load joins personal settings with the project file, then [project settings](/concepts/the-vixl-directory) overlay personal settings with these rules:

- Project values overlay personal ones for most keys.
- Keys that start with `providers.`, `models.`, or `lsp.` are personal only. If they appear in a project file they are stripped and rewritten.
- [MCP](https://modelcontextprotocol.io/) trust (`agent.mcp.trust`) unions by `serverId`. Personal `never` wins. Otherwise the project record wins.
- `agent.permissions` unions by `capability`. Personal `deny` wins, then project `deny`, else project.
- `agent.autoApproveGlobs` is the union of both string lists.

Home chats use personal settings only. Project chats use the merged result. Invalid project files fail closed to empty overrides.

## Defaults

These are the values from `defaultVixlSettings()` when a field is omitted:

| Field | Type | Default |
| --- | --- | --- |
| `version` | `1` | `1` |
| `appearance.theme` | `"light"` \| `"dark"` \| `"system"` | `"system"` |
| `appearance.transparency` | boolean | `true` |
| `appearance.transparencyHue` | number 0 to 360 | `265` |
| `appearance.transparencyIntensity` | number 0 to 100 | `0` |
| `agent.autoApproveGlobs` | string[] | `[]` |
| `agent.permissionLevel` | `"ask"` \| `"allowlist"` \| `"bypass"` | `"allowlist"` |
| `agent.permissions` | permission records | `[]` |
| `agent.mcp.trust` | trust records | `[]` |
| `agent.sandbox.enabled` | boolean | `true` |
| `agent.sandbox.network` | `"deny"` \| `"allow"` | `"allow"` |
| `lsp.autoDownload` | boolean | `true` |
| `workspace.trust` | trust records | `[]` |
| `chat.autoTitle` | boolean | `true` |
| `workbench.duplicateTabBehavior` | `"ask"` \| `"open-existing"` \| `"open-new"` | `"ask"` |

Model fields have no defaults. First run has no providers and no default model. See [Models and roles](/concepts/models-and-roles).

## Appearance

`appearance.theme` is Light, Dark, or System. `appearance.transparency` turns window transparency on. When it is on, `appearance.transparencyHue` and `appearance.transparencyIntensity` set the tint. Edit these in [Appearance](/customize/appearance).

## Agent, sandbox, and permissions

`agent.permissionLevel` is the chat permission dial: Ask, Allowlist, or Bypass. See [Permissions and approvals](/concepts/permissions-and-approvals).

`agent.permissions` is the persisted allow and deny list. Each record is:

```json
{
  "capability": "fs.write",
  "verdict": "allow",
  "scope": "workspace"
}
```

`capability` is a permission capability string such as `fs.write`, `fs.delete`, `shell`, `shell.network`, `shell.unsandboxed`, `git.commit`, `git.checkout`, `git.branch_create`, `mcp:<serverId>`, `mcp:<serverId>:<tool>`, `web.fetch`, `web.fetch:<host>`, or `workspace.move`. Path-scoped file writes use `fs.write:<path>`. `verdict` is `"allow"` or `"deny"`. `scope` on disk is `"workspace"` or `"always"` (once and session are not persisted).

`agent.autoApproveGlobs` auto-approves filesystem writes and deletes when every path matches. There is no first-party Settings UI for this list. Edit the JSON.

`agent.sandbox.enabled` sandboxes agent terminal commands. `agent.sandbox.network` is `"allow"` or `"deny"` for network inside that sandbox. Leaving the sandbox always asks. See [Permission settings](/customize/permission-settings).

## MCP trust

`agent.mcp.trust` records whether a server may start. Each record is:

```json
{
  "serverId": "github",
  "scope": "always",
  "fingerprint": "ab12cd34"
}
```

`scope` is `"session"` \| `"workspace"` \| `"always"` \| `"never"`. `fingerprint` is a hash of the command plus args, or of the URL. Missing fingerprint means untrusted until granted again. Changing transport identity requires trust again. See [mcp.json](/reference/mcp-json).

## Workspace trust

`workspace.trust` is an array of `{ "rootPath": string, "trusted": boolean }`. Project-local language servers that require trust check this list against the canonical project root.

## Models

Each role stores a model ref string `providerId::modelId`. Optional reasoning for that role is a separate field.

| Field | Role |
| --- | --- |
| `models.default` | Fallback for every role |
| `models.ask` | Ask mode |
| `models.plan` | Plan mode |
| `models.agent` | Agent mode |
| `models.orchestrator` | Orchestrator parent |
| `models.subagent` | Nested `spawn_subagent` default |
| `models.title` | Background chat titles |

Reasoning fields: `models.defaultReasoning`, `models.askReasoning`, `models.planReasoning`, `models.agentReasoning`, `models.orchestratorReasoning`, `models.subagentReasoning`, `models.titleReasoning`. Allowed values: `"provider-default"`, `"none"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`.

`models.catalogOptions` is a map from model ref to `{ reasoning?, fast?, allowed?, contextWindow?, maxOutputTokens? }`. `models.catalogMeta` is a map from model ref to `{ contextWindow?, maxOutputTokens?, pricing?, vision?, toolCalling? }`. Pricing uses USD per million tokens: `inputPerMillion`, `outputPerMillion`, optional `cacheReadPerMillion`, `cacheWritePerMillion`, `reasoningPerMillion`.

`chat.autoTitle` turns background title generation on. Edit roles in [Models](/customize/models).

## Providers

Catalog providers store only a keychain pointer:

```json
"providers.openai.apiKeyRef": "openai"
```

The secret itself is `vixl:provider:<apiKeyRef>` in the keychain.

Custom OpenAI-compatible endpoints use `providers.custom.<id>`:

```json
{
  "type": "openai-compatible",
  "name": "local",
  "baseURL": "http://localhost:1234/v1",
  "apiKeyRef": "local",
  "headers": {},
  "queryParams": {},
  "includeUsage": true,
  "supportsStructuredOutputs": false,
  "models": []
}
```

`type` must be `"openai-compatible"`. `name` is required. `baseURL` must be a URL. `apiKeyRef`, `headers`, `queryParams`, `includeUsage`, `supportsStructuredOutputs`, and `models` are optional. Each model object requires `id` and may set `name`, token limits, `toolCalling`, `vision`, `thinking`, `streaming`, sampling, `headers`, `modelOptions`, and `pricing`.

## Other fields

`lsp.autoDownload` downloads default language support when a project opens. Disable it for airgapped machines. Server install state lives in personal `lsp.json`, not here. See [Language servers](/customize/language-servers).

`workbench.duplicateTabBehavior` controls what happens when you open an editor or terminal that is already open: ask, reuse the existing tab, or open a new one.

## Example

```json
{
  "version": 1,
  "appearance.theme": "system",
  "models.default": "anthropic::claude-sonnet-4-5",
  "agent.permissionLevel": "allowlist",
  "agent.mcp.trust": [
    { "serverId": "github", "scope": "always", "fingerprint": "ab12cd34" }
  ],
  "workspace.trust": [
    { "rootPath": "/Users/you/src/vixl", "trusted": true }
  ]
}
```

See also [mcp.json](/reference/mcp-json) and [.vixl layout](/reference/vixl-layout).
