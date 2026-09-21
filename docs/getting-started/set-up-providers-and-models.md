---
title: Set up providers and models
description: Add a BYOK provider in Vixl Settings, test the connection, then assign default models for each chat role.
---

# Set up providers and models

## Adding a provider

Open **Settings** from the left sidebar footer.

Click on the Providers tab.

The providers list comes from [AI SDK](https://ai-sdk.dev/) providers, plus OpenAI-compatible hosts.

1. Select **Providers**.
2. Click **Add provider**.
3. Choose a catalog provider, or **Custom OpenAI-compatible**.
4. Save an API key if the dialog asks for one.
5. Click **Test connection**.

[Ollama](https://ollama.com/) and [LM Studio](https://lmstudio.ai/) skip the API key dialog. Ollama defaults to `http://localhost:11434/v1`. LM Studio defaults to `http://localhost:1234/v1`. Adding Ollama does not pick a default model for you.

With no providers, the section is empty until you add one. **Test connection** checks the endpoint. A 401 or 403 means the key is wrong.

## Set model roles

1. Select **Models** in settings.
2. Set **Default**.
3. Override other roles only if you want them different from Default.

**Default** is the fallback every other role uses. **Ask**, **Plan**, and **Agent** set the four chat modes (**Agent** also covers single-agent plan builds). **Orchestrator** has **Parent** plus nested **Subagent**. **Title** generates short chat titles, with an **Auto-title** switch (on by default).

Pick a model to persist that role. **Use default** clears an override. Title warns if it is still on the default, and asks you to prefer a small, low-cost model for that background task.

Without a Default (or Agent) model, starting a chat from the sidebar is blocked until you set one in Settings. Sending from the home chat input requires a model.

More on roles: [Models and roles](/concepts/models-and-roles) and [Models](/customize/models).

Next: [add a project](/getting-started/add-a-project), or skip that and [send a chat](/getting-started/your-first-chat).
