import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import type { AgentThreadViewState } from '@/composables/agent-thread-view/types'
import { createSubmitHandlers } from '@/composables/agent-thread-view/handlers-submit'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const payload = {
  text: 'look at auth next',
  mode: 'agent' as const,
  model: 'openai/gpt-4o',
}

const buildState = (overrides?: {
  isSubagentView?: boolean
  subagentId?: string
  steerSubagent?: ReturnType<typeof vi.fn<(id: string, text: string) => Promise<void>>>
  stop?: ReturnType<typeof vi.fn<() => Promise<void>>>
  stopSubagent?: ReturnType<typeof vi.fn<(id: string) => void>>
  send?: ReturnType<typeof vi.fn<(args: unknown) => Promise<void>>>
}): {
  state: AgentThreadViewState
  steerSubagent: ReturnType<typeof vi.fn<(id: string, text: string) => Promise<void>>>
  stop: ReturnType<typeof vi.fn<() => Promise<void>>>
  stopSubagent: ReturnType<typeof vi.fn<(id: string) => void>>
  send: ReturnType<typeof vi.fn<(args: unknown) => Promise<void>>>
} => {
  const steerSubagent =
    overrides?.steerSubagent ??
    vi.fn<(id: string, text: string) => Promise<void>>().mockResolvedValue(undefined)
  const stop =
    overrides?.stop ?? vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const stopSubagent = overrides?.stopSubagent ?? vi.fn<(id: string) => void>()
  const send =
    overrides?.send ??
    vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined)
  const state = {
    isSubagentView: computed(() => overrides?.isSubagentView ?? false),
    subagentId: computed(() => overrides?.subagentId ?? ''),
    projectSlug: computed(() => 'proj'),
    harness: shallowRef({
      steerSubagent,
      stop,
      stopSubagent,
      send,
    }),
    fleetSidebar: {
      refreshSlug: vi.fn<(slug: string) => Promise<void>>().mockResolvedValue(undefined),
    },
  } as unknown as AgentThreadViewState
  return { state, steerSubagent, stop, stopSubagent, send }
}

describe('createSubmitHandlers subagent view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes submit to steerSubagent and does not send on the parent', async () => {
    const { state, steerSubagent, send } = buildState({
      isSubagentView: true,
      subagentId: 'sub-1',
    })
    const handlers = createSubmitHandlers(state)
    await handlers.handleSubmit(payload)
    expect(steerSubagent).toHaveBeenCalledWith('sub-1', 'look at auth next')
    expect(send).not.toHaveBeenCalled()
  })

  it('stops only the route subagent and does not stop the parent turn', async () => {
    const { state, stop, stopSubagent } = buildState({
      isSubagentView: true,
      subagentId: 'sub-1',
    })
    const handlers = createSubmitHandlers(state)
    await handlers.handleStop()
    expect(stopSubagent).toHaveBeenCalledWith('sub-1')
    expect(stop).not.toHaveBeenCalled()
  })

  it('stops the parent turn from the parent view', async () => {
    const { state, stop, stopSubagent } = buildState({
      isSubagentView: false,
    })
    const handlers = createSubmitHandlers(state)
    await handlers.handleStop()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(stopSubagent).not.toHaveBeenCalled()
  })
})
