import { assertNotAwaitingPlanGo } from '@/services/harness/plan-execution-session'
import { pushSteer } from '@/services/harness/subagent/inbox'
import resumeSubagent from '@/services/harness/subagent/resume'
import {
  getSubagent,
  listSubagentsForChat,
} from '@/services/harness/subagent/registry'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const knownIdsLabel = (chatId: string): string => {
  const ids = listSubagentsForChat(chatId).map((record) => record.subagentId)
  return ids.length > 0 ? ids.join(', ') : '(none)'
}

const deliverSteer = async (
  ctx: HarnessToolContext,
  subagentId: string,
  message: string,
): Promise<
  | { subagentId: string; status: 'running'; note: string }
  | { subagentId: string; name: string; summary: string }
  | { error: string }
> => {
  assertNotAwaitingPlanGo(ctx.projectSlug, ctx.chatId)

  if (ctx.signal?.aborted) {
    throw new Error('Subagent aborted')
  }

  const record = getSubagent(subagentId)
  if (!record || record.chatId !== ctx.chatId) {
    return {
      error: `Unknown subagentId: ${subagentId}. Known subagent ids for this chat: ${knownIdsLabel(ctx.chatId)}`,
    }
  }

  if (record.status === 'running') {
    pushSteer(subagentId, message)
    return {
      subagentId,
      status: 'running',
      note: 'Steer will be delivered at the next step boundary.',
    }
  }

  if (record.status === 'completed' || record.status === 'failed') {
    return resumeSubagent(ctx, subagentId, message)
  }

  return {
    error: `Subagent ${subagentId} is ${record.status} and cannot be steered.`,
  }
}

export default deliverSteer
