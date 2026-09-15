import { toast } from 'vue-sonner'
import {
  abort as abortSubagentsForChat,
  abortOne,
  clearPendingBackgroundResume,
  listSubagentsForChat,
} from '@/services/harness/subagent/registry'
import { killShellsForChat } from '@/services/harness/shell/registry'
import { rejectPendingMcpAuthForChat } from '@/services/mcp/mcp-auth-gate'
import { updateChatMeta } from '@/services/vixl/vixl-tauri'
import waitUntilParentUnblocked from './wait-until-parent-unblocked'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'
import type { SendArgs } from './send'
import type { AgentHarnessState, AttentionHelpers } from './types'

type LifecycleDeps = {
  send: (args: SendArgs) => Promise<void>
  stopMcpAuthPolling: () => void
  maybeFlushBackgroundSubagentResume: () => void
}

export default (
  state: AgentHarnessState,
  attention: AttentionHelpers,
  deps: LifecycleDeps,
) => {
  const {
    options,
    session,
    status,
    subagents,
    abortController,
    pendingMcpAuth,
    messageQueue,
    suppressQueueDrainAfterStop,
  } = state

  const stopSubagent = (subagentId: string): void => {
    abortOne(subagentId)
    session.clearLocalQueuedSubagentSteers(subagentId)
    session.completeLocalSubagent(subagentId, 'Stopped', 'stopped')
    subagents.value = subagents.value.map((item) =>
      item.subagentId === subagentId
        ? { ...item, status: 'stopped', summary: 'Stopped' }
        : item,
    )
    deps.maybeFlushBackgroundSubagentResume()
  }

  const stop = async (): Promise<void> => {
    suppressQueueDrainAfterStop.value = true
    abortController.value?.abort()
    rejectPendingMcpAuthForChat(options.chatId)
    pendingMcpAuth.value = []
    deps.stopMcpAuthPolling()
    const runningIds = new Set([
      ...listSubagentsForChat(options.chatId)
        .filter((record) => record.status === 'running')
        .map((record) => record.subagentId),
      ...subagents.value
        .filter((item) => item.status === 'running')
        .map((item) => item.subagentId),
    ])
    abortSubagentsForChat(options.chatId)
    for (const subagentId of runningIds) {
      session.clearLocalQueuedSubagentSteers(subagentId)
      session.completeLocalSubagent(subagentId, 'Stopped', 'stopped')
    }
    if (runningIds.size > 0) {
      subagents.value = subagents.value.map((item) =>
        runningIds.has(item.subagentId)
          ? { ...item, status: 'stopped', summary: 'Stopped' }
          : item,
      )
    }
    status.value = 'ready'
    session.finishAgentTurn()
    try {
      await updateChatMeta(options.projectSlug, options.chatId, {
        status: 'idle',
      })
      session.patchMeta({ status: 'idle' })
      attention.refreshSidebar()
    } catch (metaError) {
      toast.error('Failed to update chat status', {
        description:
          metaError instanceof Error ? metaError.message : 'Unknown error',
      })
    }
    try {
      await killShellsForChat(options.chatId)
    } catch (stopError) {
      toast.error('Failed to stop terminals', {
        description: stopError instanceof Error ? stopError.message : 'Unknown error',
      })
    }
  }

  const forceSendQueued = async (id: string): Promise<void> => {
    const item = messageQueue.items.value.find((entry) => entry.id === id)
    if (!item) {
      return
    }
    messageQueue.remove(id)
    await stop()
    clearPendingBackgroundResume(options.chatId)
    await waitUntilParentUnblocked(state)
    if (state.disposed.value) {
      return
    }
    try {
      await deps.send({
        text: item.text,
        files: item.files,
        mode: item.mode,
        model: item.model,
        reasoning: item.reasoning,
        mentions: item.mentions,
        skipUserMessage: item.skipUserMessage,
        skipUserPersist: item.skipUserPersist,
        appendedUserMessageId: item.appendedUserMessageId,
        internal: true,
      })
    } catch (err) {
      toast.error('Failed to send queued message', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const cancelQueued = (id: string): void => {
    messageQueue.remove(id)
  }

  // Returns the queued item read-only. The view/composer slice is responsible
  // for hydrating the composer from this item and then calling cancelQueued
  // to remove it, so this slice never mutates the queue on edit.
  const editQueued = (id: string): QueuedChatMessage | undefined =>
    messageQueue.items.value.find((entry) => entry.id === id)

  const markDisposed = (): void => {
    state.disposed.value = true
  }

  const dispose = async (): Promise<void> => {
    markDisposed()
    await stop()
    messageQueue.clear()
  }

  return {
    stop,
    stopSubagent,
    forceSendQueued,
    cancelQueued,
    editQueued,
    dispose,
    markDisposed,
  }
}
