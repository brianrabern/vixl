---
title: Chat statuses
---

# Chat statuses

A chat stores two persisted fields: `status` and `attention`. The sidebar and the project Chats table derive the label you see from those fields. `status === "running"` wins. If the chat is not running, `attention` supplies the rest.

## Persisted status

`status` is `"idle"` or `"running"`. New chats start `idle`. A live parent turn sets `running`. Stop sets `idle`. If background sub-agents are still working after the parent turn ends, `status` stays `running` until they finish.

## Attention

`attention` is one of:

| Value | Sidebar / table label | Meaning |
| --- | --- | --- |
| `needs_approval` | Needs approval | A tool is waiting on Allow / Deny |
| `needs_input` | Needs input | `ask_user` is waiting for an answer |
| `needs_mcp_auth` | Needs MCP auth | An MCP server needs sign-in |
| `completed` | Done | The last turn succeeded while this chat was not the open session |
| `error` | Error | The last turn failed while this chat was not the open session |
| `null` | none (project table: Idle) | No attention. The open chat clears attention on a successful turn |

The sidebar shows no extra label for idle chats with null attention. The project Chats table labels that state Idle.

Running chats show running dots and the tooltip Running.

## In-session harness status

While a turn is in flight, the harness uses a separate [AI SDK](https://ai-sdk.dev/) chat status. Send sets `submitted`. Stream events set `streaming`. Mapping from persisted meta: submitting is `submitted`, `running` is `streaming`, `idle` is `ready`. Compact is a separate `compacting` flag, not a persisted status. Stop generating while `submitted` or `streaming` (or while waiting on background sub-agents).

## Sub-agent status

Each nested agent has `running` \| `done` \| `stopped` \| `error`. Stop on a sub-agent route stops that helper only. Stop on the parent aborts every nested agent for the chat.

MCP connection states (`connected`, `starting`, `stopped`, `error`, `auth_required`, `refreshing`) are server statuses, not chat statuses. See [mcp.json](/reference/mcp-json).

See [Manage chats](/using/manage-chats) and [Queue and stop messages](/using/queue-and-stop-messages).
