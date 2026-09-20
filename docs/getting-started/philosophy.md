---
title: Philosophy
---

# Philosophy

A short list of opinions I had when creating this project.

## No humanizing the bot (unless you want to I guess?)

Using other agent UIs I found they tend to "decorate" what the agent is doing, which feels, odd.

When working with local LLMs it's helpful to know the current state of the process.

Vixl labels the current state by always using terms such as "processing" never using marketing buzzwords.

While some would argue that "reasoning" and "thinking" also humanize the bot, I agree, but it's the default ai elements ships with.

Feel free to open an issue for this, if you can come up with something that feels better than "ITG" and reads cleanly in the chat flow.

In system prompts there is no use of "you" or making the LLM "feel like a person."

Every prompt is just technical descriptions of the flow, or tool.

Not humanizing the bot, also makes it a great blankslate.

Sometimes LLMs might be used for creative work, or other where its helpful to have it assume a personality when responding.

So by not giving it one, you can add your own.

## Plans get saved

"Planning" or the concept of todo files is something everyone is familiar with.

Some of us use ticket software like Linear, or Jira, where plans are just artifacts in the cloud.

Some people also, or often just need a better documented todo list thats persisted.

I always thought it was weird that we decided plans were markdown documentation that described the desired state of something, but everyone just decided to toss it after.

Plan mode writes a `PLAN.md` under `.vixl/plans/`.

You can also create one by hand in settings, or when viewing a projects page. 

It should just feel like writing a shopping list.

## Feature complete

Once the [roadmap](/resources/roadmap) is met, I don't really want to keep adding unless theres a very worthwhile RFC.

When you have people working 40hrs a week on a project it just becomes bloatware as new features must be added.

People just want software that works, and does a thing.

Once it does that thing, don't change the thing.

## Local first design

I bought a Framework desktop, and began playing with LLMs.

The Strix Halo is no Nvidia 5090 by any means.

So I needed a incredibly minimal harness, that wasn't a ton of config to setup.

This project was born out of that.

The alternatives were very "pick your poison" feeling.

[OpenCode](https://opencode.ai/) would not show reasoning for Qwen even though it appeared in traces.

[VS Code](https://code.visualstudio.com/) agents required an account even for local models, and plans lived in chats.

With a router you specify every model yourself.

[Cursor](https://cursor.com/) and [Antigravity](https://antigravity.google/) are cloud-only.

## Git neutrality

A LLM is a tool, not a person, and not a co-author.

## Fail loud

An app that's silent is hard to debug, you'll see toasts around the app of little non-blockers or issues.

Open an issue.

The app is meant to be minimal so all user flows are regularly walked.

This way testing, and using are often one in the same.

## No cloud, ever

Self explanatory.

## Delete means delete

No archive, or "forget" I just wanted deleted chats to be deleted.