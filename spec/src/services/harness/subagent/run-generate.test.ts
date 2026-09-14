import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { StagedImage } from '@/types/harness/staged-image'
import estimateTextTokens from '@/utils/estimate-text-tokens'

const generateText = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<{
    text: string
    usage?: unknown
    response?: { messages?: unknown[] }
    responseMessages?: unknown[]
  }>>(),
)
const createModel = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
)
const captureBillableUsage = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>(),
)
const resolveAgentDefinition = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
)
const grepExecute = vi.hoisted(() =>
  vi.fn<
    () => Promise<{ matches: string[]; truncated: boolean }>
  >(async () => ({
    matches: ['x'.repeat(100000)],
    truncated: false,
  })),
)
const stubExecute = vi.hoisted(() => vi.fn<() => Promise<unknown>>())
const buildHarnessTools = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Record<string, { execute: typeof grepExecute | typeof stubExecute }>>(
    () => ({
      read_file: { execute: stubExecute },
      grep: { execute: grepExecute },
      edit_file: { execute: stubExecute },
      apply_patch: { execute: stubExecute },
      run_terminal: { execute: stubExecute },
      git_commit: { execute: stubExecute },
    }),
  ),
)
const compactStep = vi.hoisted(() =>
  vi.fn<(options: { messages: unknown[] }) => Promise<{ messages?: unknown[] } | undefined>>(
    async () => undefined,
  ),
)
const prepareCompactStep = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => typeof compactStep>(() => compactStep),
)

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  isLoopFinished: () => () => false,
}))

vi.mock('@/services/providers/create-model', () => ({
  default: (...args: unknown[]) => createModel(...args),
}))

vi.mock('@/services/billing/capture-billable-usage', () => ({
  default: (...args: unknown[]) => captureBillableUsage(...args),
}))

vi.mock('@/services/agents/resolve-agent-definition', () => ({
  default: (...args: unknown[]) => resolveAgentDefinition(...args),
}))

vi.mock('@/services/harness/build-harness-tools', () => ({
  default: (...args: unknown[]) => buildHarnessTools(...args),
}))

vi.mock('@/services/harness/subagent/prepare-compact-step', () => ({
  default: (...args: unknown[]) => prepareCompactStep(...args),
}))

import runSubagentGenerate from '@/services/harness/subagent/run-generate'
import { pushSteer } from '@/services/harness/subagent/inbox'
import {
  getSubagent,
  register,
  resetSubagentRegistryForTests,
} from '@/services/harness/subagent/registry'

type GenerateConfig = {
  tools?: Record<string, { execute?: (...args: never[]) => Promise<unknown> }>
  prepareStep?: unknown
  system?: string
}

const TOKEN_CAP = 8000

const baseCtx = (): HarnessToolContext => ({
  projectRoot: '/tmp/project',
  projectSlug: 'project',
  chatId: 'chat-1',
  mode: 'agent',
  turnId: 'turn-1',
  settings: { version: 1 } as VixlSettings,
  permissionLevel: 'ask',
  sessionAllows: new Set(),
  sessionDenies: new Set(),
  sandboxEnabled: true,
  supportsVision: false,
  onPendingApproval: () => {},
})

describe('runSubagentGenerate compaction wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    createModel.mockResolvedValue({ id: 'stub-model' })
    captureBillableUsage.mockResolvedValue(undefined)
    resolveAgentDefinition.mockResolvedValue(null)
    generateText.mockResolvedValue({
      text: 'summary',
      usage: {},
      response: { messages: [{ role: 'assistant', content: 'summary' }] },
    })
    compactStep.mockResolvedValue(undefined)
  })

  it('wraps nested tools and passes prepareStep to generateText', async () => {
    await runSubagentGenerate({
      ctx: baseCtx(),
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })

    expect(generateText).toHaveBeenCalledTimes(1)
    const config = generateText.mock.calls[0]?.[0] as GenerateConfig
    expect(config.prepareStep).toBeTypeOf('function')

    const grep = config.tools?.grep
    expect(grep?.execute).toBeTypeOf('function')
    expect(grep?.execute).not.toBe(grepExecute)

    const result = await grep!.execute!()
    expect(result).toMatchObject({ truncated: true })
    expect(estimateTextTokens(JSON.stringify(result))).toBeLessThanOrEqual(TOKEN_CAP)
    expect(grepExecute).toHaveBeenCalled()
  })
})

describe('runSubagentGenerate capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    createModel.mockResolvedValue({ id: 'stub-model' })
    captureBillableUsage.mockResolvedValue(undefined)
    resolveAgentDefinition.mockResolvedValue(null)
    generateText.mockResolvedValue({ text: 'summary', usage: {} })
  })

  const runWithCapabilities = async (
    capabilities: 'read-only' | 'write',
  ): Promise<GenerateConfig> => {
    await runSubagentGenerate({
      ctx: baseCtx(),
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities,
    })
    return generateText.mock.calls[0]?.[0] as GenerateConfig
  }

  it('keeps only read-only tools and a read-only system prompt', async () => {
    const config = await runWithCapabilities('read-only')
    const toolNames = Object.keys(config.tools ?? {})
    expect(toolNames).toContain('read_file')
    expect(toolNames).toContain('grep')
    expect(toolNames).not.toContain('edit_file')
    expect(toolNames).not.toContain('apply_patch')
    expect(toolNames).not.toContain('run_terminal')
    expect(toolNames).not.toContain('git_commit')
    expect(config.system).toContain('read-only sub-agent')
  })

  it('includes write tools and omits the read-only system prompt', async () => {
    const config = await runWithCapabilities('write')
    const toolNames = Object.keys(config.tools ?? {})
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'read_file',
        'grep',
        'edit_file',
        'apply_patch',
        'run_terminal',
        'git_commit',
      ]),
    )
    expect(config.system).not.toContain('read-only')
  })
})

describe('runSubagentGenerate pending approval tagging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    createModel.mockResolvedValue({ id: 'stub-model' })
    captureBillableUsage.mockResolvedValue(undefined)
    resolveAgentDefinition.mockResolvedValue(null)
    generateText.mockResolvedValue({ text: 'summary', usage: {} })
  })

  it('attaches subagentId and subagentLabel before forwarding onPendingApproval', async () => {
    const onPendingApproval = vi.fn<HarnessToolContext['onPendingApproval']>()
    await runSubagentGenerate({
      ctx: { ...baseCtx(), onPendingApproval },
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'edit the auth helper',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'write',
    })

    expect(buildHarnessTools).toHaveBeenCalledTimes(1)
    const nestedCtx = buildHarnessTools.mock.calls[0]?.[0] as HarnessToolContext
    nestedCtx.onPendingApproval({
      toolCallId: 'tc-edit',
      name: 'edit_file',
      kind: 'fs',
      title: 'Edit file',
      allowedScopes: ['once'],
    })

    expect(onPendingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'tc-edit',
        name: 'edit_file',
        subagentId: 'sub-1',
        subagentLabel: 'explore',
      }),
    )
  })

  it('reuses the parent sessionAllows and sessionDenies sets', async () => {
    const ctx = baseCtx()
    await runSubagentGenerate({
      ctx,
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'edit the auth helper',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'write',
    })

    const nestedCtx = buildHarnessTools.mock.calls[0]?.[0] as HarnessToolContext
    expect(nestedCtx.sessionAllows).toBe(ctx.sessionAllows)
    expect(nestedCtx.sessionDenies).toBe(ctx.sessionDenies)
  })

  it('does not inherit parent stageImage on nested tool context', async () => {
    const stageImage = vi.fn<(image: StagedImage) => Promise<void>>()
    const ctx = { ...baseCtx(), stageImage }
    await runSubagentGenerate({
      ctx,
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'describe the screenshot',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })

    const nestedCtx = buildHarnessTools.mock.calls[0]?.[0] as HarnessToolContext
    expect(nestedCtx.stageImage).toBeUndefined()
    expect(stageImage).not.toHaveBeenCalled()
  })
})

describe('runSubagentGenerate agent definition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    createModel.mockResolvedValue({ id: 'stub-model' })
    captureBillableUsage.mockResolvedValue(undefined)
    resolveAgentDefinition.mockResolvedValue(null)
    generateText.mockResolvedValue({ text: 'summary', usage: {} })
  })

  it('puts Agent definition and body into nested system when resolved', async () => {
    resolveAgentDefinition.mockResolvedValue({
      id: 'reviewer',
      name: 'reviewer',
      description: 'Reviews diffs',
      body: 'Review the diff carefully and report risks.',
      path: '/tmp/project/.vixl/agents/reviewer.md',
      scope: 'project',
    })

    await runSubagentGenerate({
      ctx: baseCtx(),
      subagentId: 'sub-1',
      agentName: 'reviewer',
      prompt: 'review the PR',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })

    expect(resolveAgentDefinition).toHaveBeenCalledWith('/tmp/project', 'reviewer')
    const config = generateText.mock.calls[0]?.[0] as GenerateConfig
    expect(config.system).toContain('Agent definition:')
    expect(config.system).toContain('Review the diff carefully and report risks.')
  })
})

describe('runSubagentGenerate steer prepareStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    createModel.mockResolvedValue({ id: 'stub-model' })
    captureBillableUsage.mockResolvedValue(undefined)
    resolveAgentDefinition.mockResolvedValue(null)
    generateText.mockResolvedValue({
      text: 'summary',
      usage: {},
      responseMessages: [{ role: 'assistant', content: 'summary' }],
    })
    compactStep.mockResolvedValue(undefined)
  })

  const runAndPrepare = async () => {
    const events: unknown[] = []
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'call-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      model: 'local::qwen',
    })
    await runSubagentGenerate({
      ctx: {
        ...baseCtx(),
        onHarnessEvent: (event) => {
          events.push(event)
        },
      },
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })
    const config = generateText.mock.calls[0]?.[0] as GenerateConfig
    const prepareStep = config.prepareStep as (options: {
      messages: { role: string; content: string }[]
    }) => Promise<{ messages?: unknown[] } | undefined>
    return { prepareStep, events }
  }

  it('appends drained steers then runs compaction on the combined messages', async () => {
    const { prepareStep, events } = await runAndPrepare()
    pushSteer('sub-1', 'first steer')
    pushSteer('sub-1', 'second steer')
    const original = [{ role: 'user' as const, content: 'original task' }]

    const result = await prepareStep({ messages: original })

    expect(compactStep).toHaveBeenCalledWith({
      messages: [
        { role: 'user', content: 'original task' },
        { role: 'user', content: 'first steer' },
        { role: 'user', content: 'second steer' },
      ],
    })
    expect(result).toEqual({
      messages: [
        { role: 'user', content: 'original task' },
        { role: 'user', content: 'first steer' },
        { role: 'user', content: 'second steer' },
      ],
    })
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'subagent-event',
          event: { type: 'subagent-steer', message: 'first steer' },
        }),
        expect.objectContaining({
          type: 'subagent-event',
          event: { type: 'subagent-steer', message: 'second steer' },
        }),
      ]),
    )
  })

  it('still invokes compaction when a steer would exceed the window', async () => {
    compactStep.mockResolvedValue({
      messages: [{ role: 'user', content: 'compacted' }],
    })
    const { prepareStep } = await runAndPrepare()
    pushSteer('sub-1', 'huge follow-up')

    await expect(
      prepareStep({
        messages: [{ role: 'user', content: 'original task' }],
      }),
    ).resolves.toEqual({
      messages: [{ role: 'user', content: 'compacted' }],
    })
    expect(compactStep).toHaveBeenCalledTimes(1)
  })

  it('stores the initial prompt plus response messages when the run completes', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'call-1',
      agentName: 'explore',
      model: 'local::qwen',
    })
    await runSubagentGenerate({
      ctx: baseCtx(),
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })

    const stored = getSubagent('sub-1')?.messages
    expect(stored?.[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('find the auth bug'),
      }),
    )
    expect(stored?.at(-1)).toEqual({
      role: 'assistant',
      content: 'summary',
    })
  })

  it('writes each compacted snapshot into the registry before persist', async () => {
    const firstCompacted = [{ role: 'user' as const, content: 'compacted-1' }]
    const secondCompacted = [{ role: 'user' as const, content: 'compacted-2' }]
    const midRunSnapshots: unknown[][] = []

    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'call-1',
      agentName: 'explore',
      model: 'local::qwen',
    })
    compactStep
      .mockResolvedValueOnce({ messages: firstCompacted })
      .mockResolvedValueOnce({ messages: secondCompacted })
    generateText.mockImplementation(async (config) => {
      const prepareStep = (config as GenerateConfig).prepareStep as (options: {
        messages: { role: string; content: string }[]
      }) => Promise<{ messages?: unknown[] } | undefined>
      await prepareStep({
        messages: [{ role: 'user', content: 'long-1' }],
      })
      midRunSnapshots.push([...(getSubagent('sub-1')?.messages ?? [])])
      await prepareStep({
        messages: [{ role: 'user', content: 'long-2' }],
      })
      midRunSnapshots.push([...(getSubagent('sub-1')?.messages ?? [])])
      return {
        text: 'summary',
        usage: {},
        response: { messages: [{ role: 'assistant', content: 'summary' }] },
      }
    })

    await runSubagentGenerate({
      ctx: baseCtx(),
      subagentId: 'sub-1',
      agentName: 'explore',
      prompt: 'find the auth bug',
      toolCallId: 'call-1',
      signal: new AbortController().signal,
      model: 'local::qwen',
      capabilities: 'read-only',
    })

    expect(midRunSnapshots).toEqual([firstCompacted, secondCompacted])
    expect(getSubagent('sub-1')?.messages).toEqual([
      ...secondCompacted,
      { role: 'assistant', content: 'summary' },
    ])
  })
})
