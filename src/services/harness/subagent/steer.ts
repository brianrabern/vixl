import { tool } from 'ai'
import { z } from 'zod'
import deliverSteer from '@/services/harness/subagent/deliver-steer'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const steerSubagent = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Send a follow-up to a spawned subagent. Delivered at the next step if running; resumes a completed or failed subagent in the background and the harness wakes you with the result.',
    inputSchema: z.object({
      subagentId: z.string().describe('Id returned by spawn_subagent'),
      message: z.string().describe('Follow-up instructions for the subagent'),
    }),
    execute: async ({
      subagentId,
      message,
    }): Promise<
      | { subagentId: string; name: string; status: 'running'; note: string }
      | { error: string }
    > => deliverSteer(ctx, subagentId, message),
  })

export default steerSubagent
