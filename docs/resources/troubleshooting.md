---
title: Troubleshooting
---

# Troubleshooting

Every user-facing failure surfaces a toast. The launch update check is the exception: it is silent, so re-run it from Settings > General, where a failed check is visible. Errors are meant to be visible. If something looks stuck, look for the toast. Canceling a folder picker is silent. Update checks do not run in dev.

## Keychain access

API keys and [MCP](https://modelcontextprotocol.io/) secrets live in the OS keychain, service `vixl`, vault account `vixl:vault`. Keys must start with `vixl:`. Provider secrets are `vixl:provider:<apiKeyRef>`.

On macOS and Windows, a keychain error surfaces a toast. The OS text interpolates the inner error:

- `OS keychain access denied ({inner}). Unlock your system keyring or grant vixl access.`
- `OS keychain unavailable ({inner}). On Linux, ensure a Secret Service provider (for example gnome-keyring) is running.`

On Linux, if Secret Service is missing or denied, Vixl falls back to `secrets-vault.json` in the app config dir (mode `0600`).

1. Unlock the system keyring.
2. Grant Vixl access if the OS prompts.
3. Save the API key again from Settings > Providers.

See [Providers](/customize/providers) and [Privacy](/resources/privacy).

## Provider connection failures

Test connection hits the provider (or `GET {base}/v1/models` for OpenAI-compatible hosts). HTTP 401 or 403 means the key is wrong. Other failures include the server message when present.

[Ollama](https://ollama.com/) defaults to `http://localhost:11434/v1` and needs no key. [LM Studio](https://lmstudio.ai/) defaults to `http://localhost:1234/v1`. Send requires a model. Models stays blocked until a provider exists.

1. Open Settings > Providers.
2. Confirm the base URL if you use a local host.
3. Save a key if the catalog requires one.
4. Run Test connection.

See [Set up providers and models](/getting-started/set-up-providers-and-models).

## MCP trust

Untrusted servers cannot start or be called. The dialog is Trust MCP server? Choices: This session, This workspace, Always, Never. Changing command, args, or URL requires trust again. Personal Never wins over a project grant.

If the agent calls an untrusted server, the tool error says the server has not been granted trust, and to open Settings, MCP, and start the server first.

Stdio command must be an allowlisted PATH basename. HTTP URLs must be `https`, or `http` on localhost. Missing `${input:id}` values surface as `auth_required` and the secrets form.

1. Open Settings > MCP or the project MCP tab.
2. Start the server.
3. Pick a trust scope.
4. Fill secrets if the server declares inputs.

See [MCP servers](/customize/mcp-servers) and [mcp.json](/reference/mcp-json).

## CodeGraph indexing

On project activate, Vixl runs `codegraph init` if `codegraph.db` is missing, then starts an in-memory MCP server. Graph search needs a connected graph. Rebuild needs an open project and can fail visibly.

Indexes live under personal `.vixl/graphs/`, never in the repo. Rebuild from the project Graph tab.

1. Open the project.
2. Open the Graph tab.
3. Click Rebuild index if it is not Ready.

See [Code graphs](/concepts/code-graphs) and [Managed components](/reference/managed-components).

## Settings and chats

Personal config that cannot be read is visible. Chat create failures are visible. An unknown project slug redirects Home. Sidebar and file-tree chat create is blocked until a default model is set in Settings.

See [FAQ](/resources/faq) and [Chat statuses](/reference/chat-statuses).
