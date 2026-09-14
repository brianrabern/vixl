import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { VixlSettings } from '@/types/vixl/vixl-settings'

const resolveAgentDefinition = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<null>>(),
)
const listAgentIndex = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<Array<{ name: string }>>>(),
)
const getPlanExecutionSession = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => { subagentModel: string | null }>(),
)
const assertNotAwaitingPlanGo = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => void>(),
)
const registerSubagent = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const resolveSubagent = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const emitSubagentResult = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const finishSubagentWithError = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => void>(),
)
const resolveSpawnModel = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string>>(),
)
const runSubagentGenerate = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string>>(),
)
const linkAbortSignal = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('@/services/agents/resolve-agent-definition', () => ({
  default: (...args: unknown[]) => resolveAgentDefinition(...args),
  listAgentIndex: (...args: unknown[]) => listAgentIndex(...args),
}))

vi.mock('@/services/harness/plan-execution-session', () => ({
  getPlanExecutionSession: (...args: unknown[]) =>
    getPlanExecutionSession(...args),
  assertNotAwaitingPlanGo: (...args: unknown[]) =>
    assertNotAwaitingPlanGo(...args),
}))

vi.mock('@/services/harness/subagent/registry', () => ({
  register: (...args: unknown[]) => registerSubagent(...args),
  resolve: (...args: unknown[]) => resolveSubagent(...args),
}))

vi.mock('@/services/harness/subagent/helpers', () => ({
  emitSubagentResult: (...args: unknown[]) => emitSubagentResult(...args),
  finishSubagentWithError: (...args: unknown[]) =>
    finishSubagentWithError(...args),
}))

vi.mock('@/services/harness/subagent/resolve-spawn-model', () => ({
  default: (...args: unknown[]) => resolveSpawnModel(...args),
}))

vi.mock('@/services/harness/subagent/run-generate', () => ({
  default: (...args: unknown[]) => runSubagentGenerate(...args),
}))

vi.mock('@/utils/link-abort-signal', () => ({
  default: (...args: unknown[]) => linkAbortSignal(...args),
}))

import spawnSubagent from '@/services/harness/subagent/spawn'

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

const execute = (agentName: string): Promise<unknown> => {
  const built = spawnSubagent(baseCtx())
  const runner = built.execute as (
    value: Record<string, unknown>,
    options: { toolCallId: string },
  ) => Promise<unknown>
  return runner(
    {
      agentName,
      prompt: 'Find auth helpers.',
      mode: 'blocking',
    },
    { toolCallId: 'call-1' },
  )
}

describe('spawn_subagent agentName validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAgentDefinition.mockResolvedValue(null)
    listAgentIndex.mockResolvedValue([{ name: 'explorer' }, { name: 'reviewer' }])
    getPlanExecutionSession.mockReturnValue({ subagentModel: null })
    resolveSpawnModel.mockResolvedValue('anthropic::claude-sonnet-4')
    runSubagentGenerate.mockResolvedValue('ok summary')
  })

  it('returns a tool error listing catalog names for unresolved names', async () => {
    await expect(execute('shell')).rejects.toThrow(
      /Unknown agentName "shell".*Valid catalog names: explorer, reviewer/,
    )
    expect(registerSubagent).not.toHaveBeenCalled()
    expect(runSubagentGenerate).not.toHaveBeenCalled()
  })

  it('emits agentName on subagent-start for a verb phrase helper', async () => {
    const events: Array<{ type: string; name?: string }> = []
    const ctx = baseCtx()
    ctx.onHarnessEvent = (event) => {
      events.push(event as { type: string; name?: string })
    }
    const built = spawnSubagent(ctx)
    const runner = built.execute as (
      value: Record<string, unknown>,
      options: { toolCallId: string },
    ) => Promise<unknown>
    await runner(
      {
        agentName: 'Reading auth',
        prompt: 'Find auth helpers.',
        mode: 'blocking',
      },
      { toolCallId: 'call-1' },
    )
    const start = events.find((event) => event.type === 'subagent-start')
    expect(start).toMatchObject({
      name: 'Reading auth',
    })
    expect(start && 'description' in start).toBe(false)
  })

  it('instructs the parent to review results and steer rather than spawn duplicates', () => {
    const built = spawnSubagent(baseCtx())
    expect(built.description).toContain('steer_subagent')
    expect(built.description).toContain('Review each returned result')
    expect(built.description).toContain('as each background subagent finishes')
  })
})
