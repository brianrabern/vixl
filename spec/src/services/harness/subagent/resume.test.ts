import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelMessage } from 'ai'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { VixlSettings } from '@/types/vixl/vixl-settings'

const runSubagentGenerate = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string>>(),
)
const linkAbortSignal = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const emitSubagentResult = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const finishSubagentWithError = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => void>(),
)

vi.mock('@/services/harness/subagent/run-generate', () => ({
  default: (...args: unknown[]) => runSubagentGenerate(...args),
}))

vi.mock('@/utils/link-abort-signal', () => ({
  default: (...args: unknown[]) => linkAbortSignal(...args),
}))

vi.mock('@/services/harness/subagent/helpers', () => ({
  emitSubagentResult: (...args: unknown[]) => emitSubagentResult(...args),
  finishSubagentWithError: (...args: unknown[]) =>
    finishSubagentWithError(...args),
  sanitizeSubagentName: (name: string) => name,
}))

import resumeSubagent from '@/services/harness/subagent/resume'
import {
  getSubagent,
  listDeliverableBackgroundResults,
  markBackgroundResultsDelivered,
  register,
  resetSubagentRegistryForTests,
  resolve,
  setMessages,
} from '@/services/harness/subagent/registry'

const baseCtx = (): HarnessToolContext => ({
  projectRoot: '/tmp/project',
  projectSlug: 'project',
  chatId: 'chat-1',
  mode: 'agent',
  settings: { version: 1 } as VixlSettings,
  permissionLevel: 'ask',
  sessionAllows: new Set(),
  sessionDenies: new Set(),
  sandboxEnabled: true,
  supportsVision: false,
  onPendingApproval: () => {},
  onHarnessEvent: () => {},
})

describe('resumeSubagent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    runSubagentGenerate.mockResolvedValue('second summary')
  })

  it('moves completed to running, appends the user message, and reruns generate', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
      prompt: 'first task',
      model: 'local::qwen',
      capabilities: 'read-only',
    })
    const history: ModelMessage[] = [
      { role: 'user', content: 'first task' },
      { role: 'assistant', content: 'first summary' },
    ]
    setMessages('sub-1', history)
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'first summary',
    })

    const events: unknown[] = []
    const ctx = {
      ...baseCtx(),
      onHarnessEvent: (event: unknown) => {
        events.push(event)
      },
    }

    await expect(resumeSubagent(ctx, 'sub-1', 'keep going')).resolves.toEqual({
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'second summary',
    })

    expect(getSubagent('sub-1')?.status).toBe('completed')
    expect(runSubagentGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        subagentId: 'sub-1',
        messages: [
          ...history,
          { role: 'user', content: 'keep going' },
        ],
        model: 'local::qwen',
      }),
    )
    expect(events).toEqual([
      expect.objectContaining({
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: { type: 'subagent-steer', message: 'keep going' },
      }),
    ])
    expect(emitSubagentResult).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        subagentId: 'sub-1',
        summary: 'second summary',
        outcome: 'completed',
      }),
    )
  })

  it('continues resume from compacted history stored on the record', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
      prompt: 'first task',
      model: 'local::qwen',
      capabilities: 'read-only',
    })
    const compacted: ModelMessage[] = [
      { role: 'user', content: 'compacted checkpoint' },
    ]
    setMessages('sub-1', compacted)
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'first summary',
    })

    await resumeSubagent(baseCtx(), 'sub-1', 'keep going')

    expect(runSubagentGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        subagentId: 'sub-1',
        messages: [
          ...compacted,
          { role: 'user', content: 'keep going' },
        ],
      }),
    )
  })

  it('rejects resume unless the subagent is completed or failed', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
      model: 'local::qwen',
    })

    const error = await resumeSubagent(baseCtx(), 'sub-1', 'nope').catch(
      (caught: unknown) => caught,
    )
    expect(error).toEqual(expect.objectContaining({
      message: 'Subagent cannot be resumed: sub-1',
    }))
    expect(error).not.toEqual(expect.objectContaining({
      steerDeliveryStarted: true,
    }))
    expect(runSubagentGenerate).not.toHaveBeenCalled()
  })

  it('marks delivery started when generate fails after reopen', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
      model: 'local::qwen',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'first summary',
    })
    runSubagentGenerate.mockRejectedValue(new Error('generate failed'))

    const ctx = baseCtx()
    const error = await resumeSubagent(ctx, 'sub-1', 'keep going').catch(
      (caught: unknown) => caught,
    )

    expect(error).toEqual(expect.objectContaining({
      message: 'generate failed',
      steerDeliveryStarted: true,
    }))
    expect(finishSubagentWithError).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        subagentId: 'sub-1',
        blocking: true,
      }),
    )
  })

  it('makes the steered summary deliverable after a prior parent flush', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
      model: 'local::qwen',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'first summary',
    })
    markBackgroundResultsDelivered('chat-1', ['tc-1'])
    expect(listDeliverableBackgroundResults('chat-1')).toEqual([])

    await resumeSubagent(baseCtx(), 'sub-1', 'keep going')

    expect(listDeliverableBackgroundResults('chat-1')).toEqual([
      {
        toolCallId: 'tc-1',
        result: {
          subagentId: 'sub-1',
          name: 'explorer',
          summary: 'second summary',
        },
      },
    ])
  })
})
