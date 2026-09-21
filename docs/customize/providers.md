---
title: Providers
description: Providers are personal BYOK endpoints in Vixl Settings; API keys go in the OS keychain, never in settings.json.
---

# Providers

Providers are personal. They live in Settings > Providers and write to `settings.json` under the user [`.vixl` directory](/concepts/the-vixl-directory). Project folders cannot override them. API keys never go in that JSON.

You add a catalog entry or a custom endpoint, then store the secret in the OS keychain. The model picker on the [chat input](/getting-started/your-first-chat) stays disabled until at least one provider exists. See [How Vixl works](/concepts/).

## Add a catalog provider

1. Open Settings.
2. Open Providers.
3. Open Add provider.
4. Pick a name from **AI SDK providers** or **OpenAI-compatible**.

The dialog searches by display name or id. Empty search shows the full catalog. The catalog tracks the AI SDK provider list plus first-party OpenAI-compatible endpoints. Vixl does not add community or unofficial providers.

Choosing a catalog id writes `providers.<id>.apiKeyRef` (the ref is that provider id) and, unless the provider skips a key, opens **Add API key**. [Ollama](https://ollama.com) and [LM Studio](https://lmstudio.ai) do not require an API key and skip that dialog.

## API keys in the keychain

Save the password field (placeholder `sk-...`). Empty save is refused.

The secret is stored as `vixl:provider:<apiKeyRef>`. Keys must start with `vixl:`. The vault account `vixl:vault` is reserved. On macOS and Windows the OS keychain service is `vixl`, one JSON vault. On Linux, Vixl uses Secret Service when it is available, otherwise `secrets-vault.json` in the app config dir (mode `0600`). Legacy per-key entries migrate into the vault on read.

The row status is "API key configured", "No API key", or "API key optional". Pencil edits the key. A key button appears when a secret exists. **Clear key** removes the secret. Refresh tests the connection.

## Test connection

Refresh on a row tests that provider. [Ollama](https://ollama.com) hits `GET http://localhost:11434/v1/models` with no Bearer header if the key is empty. HTTP 401 or 403 means the key is wrong. Other failures include the server message when present.

Default base URLs used for test, live `/models` listing, and runtime:

- [Ollama](https://ollama.com): `http://localhost:11434/v1`
- [LM Studio](https://lmstudio.ai): `http://localhost:1234/v1`

Adding Ollama does not pick a default model. If live listing fails, the catalog fallback id is `llama3.2`.

## Custom OpenAI-compatible endpoint

**Custom OpenAI-compatible** opens the manage dialog (title **Custom OpenAI-compatible provider**). Defaults: name `local`, base URL `http://localhost:1234/v1`.

Fields:

- Name and Base URL (required URL)
- API key, optional. Copy: "Leave blank for local servers that do not require authentication."
- Include usage (default on)
- Structured outputs (default off)
- **Test connection**
- Collapsible headers and query params
- Models: import from `/models`, add a model, or leave empty and rely on live `/models` listing

Per model: id, display name, context and max in/out, Tools / Vision / Thinking / Stream, pricing USD/1M, plus advanced sampling, reasoning, headers, and JSON `modelOptions`. Missing pricing shows an amber warning.

The saved type is `openai-compatible`. Name must be at least one character. Invalid config is refused. Create writes `providers.custom.<id>` where id is the slug of the name (stable on edit). Optional `setSecret` / `deleteSecret` for the key. Create and edit stay in the dialog.

Import from `/models` adds new ids, skips duplicates, and no-ops if the endpoint returns none.

A custom row subtitle is the configured model count. Trash deletes the keychain secret and the settings keys.

## Routers

Vixl makes working with routers easy. Point a custom OpenAI-compatible endpoint at the router, then Import from `/models`. That GETs `{baseURL}/models` and adds new ids (skips duplicates), so you pick models instead of typing ids. Example: [OpenRouter](https://openrouter.ai) (also in the OpenAI-compatible catalog).

## AI SDK providers

The add dialog groups these under **AI SDK providers**. They are first-party [AI SDK](https://ai-sdk.dev) packages.

AI Gateway, Alibaba, Amazon Bedrock, Anthropic, AssemblyAI, Azure OpenAI, Baseten, Black Forest Labs, ByteDance, Cartesia, Cerebras, Claude Platform on AWS, Cohere, Deepgram, DeepInfra, DeepSeek, ElevenLabs, Fal, Fireworks, Gladia, Google, Google Vertex AI, Groq, Hugging Face, Hume, Kling AI, LMNT, Luma, Mistral AI, Moonshot AI, Open Responses, OpenAI, Perplexity, Prodia, QuiverAI, Replicate, Rev.ai, Together.ai, Vercel, Voyage AI, xAI Grok.

Catalog ids, in the same order: `gateway`, `alibaba`, `amazon-bedrock`, `anthropic`, `assemblyai`, `azure`, `baseten`, `black-forest-labs`, `bytedance`, `cartesia`, `cerebras`, `claude-aws`, `cohere`, `deepgram`, `deepinfra`, `deepseek`, `elevenlabs`, `fal`, `fireworks`, `gladia`, `google`, `google-vertex`, `groq`, `huggingface`, `hume`, `klingai`, `lmnt`, `luma`, `mistral`, `moonshotai`, `open-responses`, `openai`, `perplexity`, `prodia`, `quiverai`, `replicate`, `revai`, `togetherai`, `vercel`, `voyage`, `xai`.

## OpenAI-compatible catalog

The add dialog groups these under **OpenAI-compatible**. They speak an OpenAI-style `/v1` HTTP API.

- [Clarifai](https://www.clarifai.com) (`clarifai`), default base URL `https://api.clarifai.com/v2`
- [Heroku](https://www.heroku.com) (`heroku`)
- [LM Studio](https://lmstudio.ai) (`lmstudio`), `http://localhost:1234/v1`, no API key required
- [NEAR AI Cloud](https://near.ai) (`near-ai`)
- [NVIDIA NIM](https://developer.nvidia.com/nim) (`nvidia-nim`), `https://integrate.api.nvidia.com/v1`
- [Ollama](https://ollama.com) (`ollama`), `http://localhost:11434/v1`, no API key required
- [OpenRouter](https://openrouter.ai) (`openrouter`), `https://openrouter.ai/api/v1`

That is 48 catalog entries plus any custom endpoints you add.

See [settings.json](/reference/settings-json) for the stored keys. Next: [Models](/customize/models).
