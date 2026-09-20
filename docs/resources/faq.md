---
title: FAQ
---

# FAQ

## What does Vixl stand for?

Vixl stands for "Vue Pixel", a love of building websites (pixels on a screen) with [Vue](https://vuejs.org/).

## Is Vixl going to keep adding features forever?

No. Once the [roadmap](/resources/roadmap) is met, Vixl gets only optimizations and bug fixes. Paid harnesses bloat because employees working 40-hour weeks need something to do. See [Philosophy](/getting-started/philosophy).

## Is there a cloud service?

No, never. There is no Vixl account and no Vixl home server. You bring your own keys and hosts. See [Privacy](/resources/privacy).

## Where are my keys?

In the OS keychain. Provider secrets use `vixl:provider:<apiKeyRef>`. MCP input secrets use `vixl:mcp:<serverId>:input:<inputId>`. They are never written to `.vixl` or `settings.json`. On Linux without Secret Service, they fall back to `secrets-vault.json` in the app config dir.

## Do I need an account to use a local model?

No. [Ollama](https://ollama.com/) and other local OpenAI-compatible hosts work without a Vixl account and without an API key. Add a provider when you want one.

## Where is my data?

Personal config is `{appData}/.vixl` (on macOS, `~/Library/Application Support/app.vixl/.vixl`). Project config is `<repo>/.vixl`. Chat rows live in `vixl.sqlite`. Chat files live under `.vixl/chats/`. See [.vixl layout](/reference/vixl-layout).

## What happens when I delete a chat?

The SQLite row and the chat directory are removed. There is no archive and no Vixl-side memory of that thread. If you used a cloud provider, that provider's retention is the provider's business. See [Privacy](/resources/privacy) and [Manage chats](/using/manage-chats).

## Does Vixl send analytics?

No. The only telemetry string in the app is `CODEGRAPH_TELEMETRY=0`, which turns off the CodeGraph package's own telemetry. Network calls are the ones you configure: providers, MCP servers, and updates from [GitHub Releases](https://github.com/vixl-ai/vixl/releases).

## What license is Vixl?

[MIT](https://github.com/vixl-ai/vixl/blob/main/LICENSE). The desktop app is free. You pay the model host you configured. There is no Vixl subscription.

## How do I install it?

Download a build from [GitHub Releases](https://github.com/vixl-ai/vixl/releases) (macOS arm64, Linux x64, Windows), or build from source. See [Installation](/getting-started/installation).

See [Troubleshooting](/resources/troubleshooting) and [Comparison](/resources/comparison).
