import { tool } from 'ai'
import { z } from 'zod'
import deliverSteer from '@/services/harness/subagent/deliver-steer'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const steerSubagent = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Send a follow-up to a spawned subagent. Delivered at the next step if running; resumes a completed or failed subagent.',
    inputSchema: z.object({
      subagentId: z.string().describe('Id returned by spawn_subagent'),
      message: z.string().describe('Follow-up instructions for the subagent'),
    }),
    execute: async ({
      subagentId,
      message,
    }): Promise<
      | { subagentId: string; status: 'running'; note: string }
      | { subagentId: string; name: string; summary: string }
      | { error: string }
    > => deliverSteer(ctx, subagentId, message),
  })

export default steerSubagent
