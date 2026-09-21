---
title: mcp.json
description: mcp.json holds Vixl MCP server configs for personal and project scope; secrets stay in the OS keychain, not this file.
---

# mcp.json

MCP ([Model Context Protocol](https://modelcontextprotocol.io/)) server configs live in `mcp.json`. Personal file: `{appData}/.vixl/mcp.json`. Project file: `<repo>/.vixl/mcp.json`. Secrets are not written here. They go in the OS keychain. See [MCP servers](/customize/mcp-servers).

Read and write go through `read_mcp_config` / `write_mcp_config`. A missing file is an empty config (`{ "servers": {} }`). Invalid server entries are dropped. If every server fails to parse, load errors with `MCP config servers failed to parse` and migrate falls back to empty.

## Config shape

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${input:GITHUB_TOKEN}" },
      "enabled": true
    },
    "docs": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "${input:Authorization}" },
      "oauth": {
        "clientId": "optional-static-client",
        "allowedAuthorizationServers": ["https://auth.example.com"]
      },
      "enabled": true
    }
  },
  "inputs": [
    {
      "id": "GITHUB_TOKEN",
      "type": "promptString",
      "description": "GITHUB_TOKEN",
      "password": true
    }
  ]
}
```

`servers` is required. `inputs` is optional.

Project `servers[id]` replaces personal `servers[id]` (scope `overridden`). Inputs merge by `id`. Project wins on the same id. The reserved id `codegraph` is stripped from user lists. Vixl starts CodeGraph in memory. Do not add it here. See [Code graphs](/concepts/code-graphs).

`enabled: false` turns a server off. Missing `enabled` is on.

## Stdio servers

A stdio server has `command` (required) plus optional `args`, `env`, `envFile`, and `enabled`. There is no `type` field.

`command` must be a PATH basename, not a filesystem path. Allowed names: `npx`, `npm`, `node`, `pnpm`, `yarn`, `bun`, `bunx`, `deno`, `uvx`, `uv`, `python`, `python3`, `pipx`, `codegraph`, `docker`, `podman`, `nerdctl`. Typical forms: `npx -y <pkg>`, `uvx <pkg>`, or `docker run`.

Stdio is a [Tauri](https://v2.tauri.app/) child process over stdin/stdout. It does not use the JS MCP SDK.

## HTTP and SSE servers

HTTP and SSE servers set `type` to `"http"` or `"sse"` and require `url` (must parse as a URL). Optional: `headers`, `oauth`, `enabled`.

URL policy: `https`, or `http` only on `localhost`, `127.0.0.1`, or `::1`. These clients run in the [Vue](https://vuejs.org/) UI process via [`@ai-sdk/mcp`](https://ai-sdk.dev/).

`oauth` is `{ "clientId"?: string, "allowedAuthorizationServers"?: string[] }`. Authorization server URLs must be valid URLs. Tokens and client secrets stay in the keychain (`vixl:mcp:<serverId>:oauth:tokens` and related keys).

## Templates and inputs

Values in `args`, `env`, and `headers` may contain `${input:id}` and `${env:NAME}`. Missing input at start sets status `auth_required` and opens the secrets form. Missing env throws `Missing environment variable: NAME`.

Each input is:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Required. Referenced as `${input:id}`. |
| `type` | `"promptString"` | Only allowed type. |
| `description` | string | Optional. |
| `password` | boolean | Optional. |

Resolved input values are stored as `vixl:mcp:<serverId>:input:<inputId>`.

## Trust

Trust is not in `mcp.json`. It lives in `settings.json` as `agent.mcp.trust`, keyed by server id and a fingerprint of command plus args, or of the URL. Untrusted servers cannot start or be called. Choices: This session, This workspace, Always, Never. See [settings.json](/reference/settings-json).

## Runtime statuses

These are connection states, not chat statuses: `connected`, `starting`, `stopped`, `error`, `auth_required`, `refreshing`.

See also [Chat statuses](/reference/chat-statuses) and [Troubleshooting](/resources/troubleshooting).
