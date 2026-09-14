import type { ModelMessage } from 'ai'
import attachSteerDeliveryStarted from '@/utils/attach-steer-delivery-started'
import linkAbortSignal from '@/utils/link-abort-signal'
import {
  emitSubagentResult,
  finishSubagentWithError,
} from '@/services/harness/subagent/helpers'
import {
  getSubagent,
  reopen,
  resolve as resolveSubagent,
  setMessages,
} from '@/services/harness/subagent/registry'
import runSubagentGenerate from '@/services/harness/subagent/run-generate'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const resumeSubagent = async (
  ctx: HarnessToolContext,
  subagentId: string,
  message: string,
): Promise<{ subagentId: string; name: string; summary: string }> => {
  const record = getSubagent(subagentId)
  if (!record || record.chatId !== ctx.chatId) {
    throw new Error(`Subagent not found: ${subagentId}`)
  }
  if (!record.model) {
    throw new Error(`Subagent has no stored model: ${subagentId}`)
  }

  const controller = new AbortController()
  linkAbortSignal(ctx.signal, controller)
  const reopened = reopen(subagentId, controller)
  if (!reopened) {
    throw new Error(`Subagent cannot be resumed: ${subagentId}`)
  }

  try {
    const nextMessages: ModelMessage[] = [
      ...(record.messages ?? []),
      { role: 'user', content: message },
    ]
    setMessages(subagentId, nextMessages)

    ctx.onHarnessEvent?.({
      type: 'subagent-event',
      subagentId,
      parentToolCallId: record.toolCallId,
      event: { type: 'subagent-steer', message },
    })

    const summary = await runSubagentGenerate({
      ctx,
      subagentId,
      agentName: record.agentName,
      prompt: message,
      toolCallId: record.toolCallId,
      signal: controller.signal,
      model: record.model,
      capabilities: record.capabilities ?? 'read-only',
      messages: nextMessages,
    })

    resolveSubagent(subagentId, {
      subagentId,
      name: record.agentName,
      summary,
    })
    emitSubagentResult(ctx, {
      subagentId,
      summary,
      blocking: true,
      outcome: 'completed',
    })

    return { subagentId, name: record.agentName, summary }
  } catch (error) {
    if (getSubagent(subagentId)?.status === 'running') {
      finishSubagentWithError(ctx, {
        subagentId,
        error,
        blocking: true,
      })
    }
    throw attachSteerDeliveryStarted(error)
  }
}

export default resumeSubagent
