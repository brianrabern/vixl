import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import type { AgentHarnessState } from '@/composables/agent-harness/types'
import type { VixlSettings } from '@/types/vixl/vixl-settings'

const deliverSteer = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
)
const loadEffectiveSettings = vi.hoisted(() =>
  vi.fn<(root: string | null) => Promise<VixlSettings>>(),
)
const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('@/services/harness/subagent/deliver-steer', () => ({
  default: (...args: unknown[]) => deliverSteer(...args),
}))

vi.mock('@/services/config/vixl-config', () => ({
  loadEffectiveSettings: (root: string | null) => loadEffectiveSettings(root),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import createSteer from '@/composables/agent-harness/steer'

const buildState = (): AgentHarnessState =>
  ({
    options: {
      projectSlug: 'proj',
      chatId: 'chat-1',
      projectRoot: '/tmp/proj',
      projectName: 'proj',
      standalone: false,
    },
    session: {
      meta: ref({ mode: 'agent' }),
      queueLocalSubagentSteer: vi.fn<(id: string, message: string) => void>(),
      rollbackLocalSubagentSteer: vi.fn<
        (id: string, message: string, status: string) => void
      >(),
      getSubagent: vi.fn<
        (id: string) => {
          status: 'done'
          name: string
          blocking: boolean
        } | null
      >(() => ({
        status: 'done',
        name: 'explorer',
        blocking: false,
      })),
    },
    lastRunConfig: ref(null),
    sessionPermissionLevel: ref('ask'),
    sessionAllows: new Set<string>(),
    sessionDenies: new Set<string>(),
    subagents: shallowRef([
      {
        subagentId: 'sub-1',
        name: 'explorer',
        blocking: false,
        status: 'done',
        events: [],
      },
    ]),
  }) as unknown as AgentHarnessState

describe('agent-harness steerSubagent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadEffectiveSettings.mockResolvedValue({ version: 1 } as VixlSettings)
    deliverSteer.mockResolvedValue({
      subagentId: 'sub-1',
      status: 'running',
      note: 'Steer will be delivered at the next step boundary.',
    })
  })

  it('queues the message on the timeline then delivers through the service', async () => {
    const state = buildState()
    const handleEvent = vi.fn<(event: unknown) => void>()
    const persistPermission = vi.fn<(...args: unknown[]) => Promise<void>>()
    const { steerSubagent } = createSteer(state, {
      handleEvent,
      persistPermission,
    })

    await steerSubagent('sub-1', '  keep going  ')

    expect(state.session.queueLocalSubagentSteer).toHaveBeenCalledWith(
      'sub-1',
      'keep going',
    )
    expect(deliverSteer).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        projectSlug: 'proj',
      }),
      'sub-1',
      'keep going',
    )
    expect(state.subagents.value[0]?.status).toBe('running')
    expect(state.session.rollbackLocalSubagentSteer).not.toHaveBeenCalled()
  })

  it('rolls back pending steer and running status when deliverSteer returns an error', async () => {
    deliverSteer.mockResolvedValue({ error: 'Subagent sub-1 is aborted and cannot be steered.' })
    const state = buildState()
    const { steerSubagent } = createSteer(state, {
      handleEvent: vi.fn<(event: unknown) => void>(),
      persistPermission: vi.fn<(...args: unknown[]) => Promise<void>>(),
    })

    await steerSubagent('sub-1', 'retry')

    expect(toastError).toHaveBeenCalledWith(
      'Failed to steer subagent',
      expect.objectContaining({
        description: 'Subagent sub-1 is aborted and cannot be steered.',
      }),
    )
    expect(state.session.rollbackLocalSubagentSteer).toHaveBeenCalledWith(
      'sub-1',
      'retry',
      'done',
    )
    expect(state.subagents.value[0]?.status).toBe('done')
  })

  it('rolls back pending steer when deliverSteer throws before delivery starts', async () => {
    deliverSteer.mockRejectedValue(new Error('Subagent aborted'))
    const state = buildState()
    const { steerSubagent } = createSteer(state, {
      handleEvent: vi.fn<(event: unknown) => void>(),
      persistPermission: vi.fn<(...args: unknown[]) => Promise<void>>(),
    })

    await steerSubagent('sub-1', 'retry')

    expect(state.session.rollbackLocalSubagentSteer).toHaveBeenCalledWith(
      'sub-1',
      'retry',
      'done',
    )
    expect(state.subagents.value[0]?.status).toBe('done')
  })

  it('keeps the failed outcome when resume fails after delivery started', async () => {
    const state = buildState()
    deliverSteer.mockImplementation(async () => {
      state.subagents.value = state.subagents.value.map((item) =>
        item.subagentId === 'sub-1'
          ? { ...item, status: 'error', summary: 'generate failed' }
          : item,
      )
      throw Object.assign(new Error('generate failed'), {
        steerDeliveryStarted: true,
      })
    })
    const { steerSubagent } = createSteer(state, {
      handleEvent: vi.fn<(event: unknown) => void>(),
      persistPermission: vi.fn<(...args: unknown[]) => Promise<void>>(),
    })

    await steerSubagent('sub-1', 'retry')

    expect(toastError).toHaveBeenCalledWith(
      'Failed to steer subagent',
      expect.objectContaining({
        description: 'generate failed',
      }),
    )
    expect(state.session.rollbackLocalSubagentSteer).not.toHaveBeenCalled()
    expect(state.subagents.value[0]?.status).toBe('error')
    expect(state.subagents.value[0]?.summary).toBe('generate failed')
  })

  it('re-adds a missing subagent as running when steered', async () => {
    const state = buildState()
    state.subagents.value = []
    const { steerSubagent } = createSteer(state, {
      handleEvent: vi.fn<(event: unknown) => void>(),
      persistPermission: vi.fn<(...args: unknown[]) => Promise<void>>(),
    })

    await steerSubagent('sub-1', 'keep going')

    expect(state.subagents.value).toEqual([
      {
        subagentId: 'sub-1',
        name: 'explorer',
        blocking: false,
        status: 'running',
        events: [],
      },
    ])
    expect(state.session.rollbackLocalSubagentSteer).not.toHaveBeenCalled()
  })

  it('removes an inserted subagent entry when steer delivery fails', async () => {
    deliverSteer.mockResolvedValue({ error: 'Unknown subagentId: sub-1' })
    const state = buildState()
    state.subagents.value = []
    const { steerSubagent } = createSteer(state, {
      handleEvent: vi.fn<(event: unknown) => void>(),
      persistPermission: vi.fn<(...args: unknown[]) => Promise<void>>(),
    })

    await steerSubagent('sub-1', 'retry')

    expect(state.session.rollbackLocalSubagentSteer).toHaveBeenCalledWith(
      'sub-1',
      'retry',
      'done',
    )
    expect(state.subagents.value).toEqual([])
  })
})
