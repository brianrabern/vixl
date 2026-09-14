import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import type { AgentHarnessState, AttentionHelpers } from '@/composables/agent-harness/types'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'

const abortSubagentsForChat = vi.hoisted(() => vi.fn<(chatId: string) => void>())
const abortOne = vi.hoisted(() => vi.fn<(subagentId: string) => void>())
const clearPendingBackgroundResume = vi.hoisted(() =>
  vi.fn<(chatId: string) => void>(),
)
const listSubagentsForChat = vi.hoisted(() =>
  vi
    .fn<(chatId: string) => Array<{ subagentId: string; status: string }>>()
    .mockReturnValue([]),
)
const killShellsForChat = vi.hoisted(() =>
  vi.fn<(chatId: string) => Promise<void>>().mockResolvedValue(undefined),
)
const rejectPendingMcpAuthForChat = vi.hoisted(() =>
  vi.fn<(chatId: string) => void>(),
)
const updateChatMeta = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
)

vi.mock('@/services/harness/subagent/registry', () => ({
  abort: (chatId: string) => abortSubagentsForChat(chatId),
  abortOne: (subagentId: string) => abortOne(subagentId),
  clearPendingBackgroundResume: (chatId: string) =>
    clearPendingBackgroundResume(chatId),
  listSubagentsForChat: (chatId: string) => listSubagentsForChat(chatId),
}))

vi.mock('@/services/harness/shell/registry', () => ({
  killShellsForChat: (chatId: string) => killShellsForChat(chatId),
}))

vi.mock('@/services/mcp/mcp-auth-gate', () => ({
  rejectPendingMcpAuthForChat: (chatId: string) =>
    rejectPendingMcpAuthForChat(chatId),
}))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    updateChatMeta: (...args: unknown[]) => updateChatMeta(...args),
  }),
)

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

import createLifecycle from '@/composables/agent-harness/lifecycle'

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
      completeLocalSubagent: vi.fn<(...args: unknown[]) => void>(),
      clearLocalQueuedSubagentSteers: vi.fn<(id: string) => void>(),
      finishAgentTurn: vi.fn<() => void>(),
      patchMeta: vi.fn<(patch: unknown) => void>(),
    },
    status: ref('streaming'),
    subagents: shallowRef([
      {
        subagentId: 'run-1',
        name: 'explorer',
        blocking: false,
        status: 'running',
        events: [],
      },
    ]),
    abortController: ref(new AbortController()),
    pendingMcpAuth: shallowRef([]),
    messageQueue: {
      items: ref([]),
      remove: vi.fn<(id: string) => void>(),
      clear: vi.fn<() => void>(),
    },
    suppressQueueDrainAfterStop: ref(false),
    compacting: ref(false),
    resumingBackgroundBatch: ref(false),
    disposed: ref(false),
  }) as unknown as AgentHarnessState

const buildAttention = (): AttentionHelpers =>
  ({
    refreshSidebar: vi.fn<() => void>(),
  }) as unknown as AttentionHelpers

describe('agent-harness lifecycle stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateChatMeta.mockResolvedValue(undefined)
    killShellsForChat.mockResolvedValue(undefined)
    listSubagentsForChat.mockReturnValue([])
  })

  it('suppresses queue drain and still aborts running subagents', async () => {
    const state = buildState()
    const { stop } = createLifecycle(state, buildAttention(), {
      send: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    await stop()

    expect(state.suppressQueueDrainAfterStop.value).toBe(true)
    expect(abortSubagentsForChat).toHaveBeenCalledWith('chat-1')
    expect(state.session.clearLocalQueuedSubagentSteers).toHaveBeenCalledWith(
      'run-1',
    )
    expect(state.subagents.value[0]?.status).toBe('stopped')
    expect(state.status.value).toBe('ready')
  })

  it('finalizes a steered-and-resumed subagent missing from the live list', async () => {
    const state = buildState()
    state.subagents.value = []
    listSubagentsForChat.mockReturnValue([
      { subagentId: 'steered-1', status: 'running' },
    ])
    const { stop } = createLifecycle(state, buildAttention(), {
      send: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    await stop()

    expect(listSubagentsForChat).toHaveBeenCalledWith('chat-1')
    expect(abortSubagentsForChat).toHaveBeenCalledWith('chat-1')
    expect(state.session.clearLocalQueuedSubagentSteers).toHaveBeenCalledWith(
      'steered-1',
    )
    expect(state.session.completeLocalSubagent).toHaveBeenCalledWith(
      'steered-1',
      'Stopped',
      'stopped',
    )
  })

  it('clears undelivered pending steers when stopping one subagent', () => {
    const state = buildState()
    const maybeFlushBackgroundSubagentResume = vi.fn<() => void>()
    const { stopSubagent } = createLifecycle(state, buildAttention(), {
      send: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume,
    })

    stopSubagent('run-1')

    expect(abortOne).toHaveBeenCalledWith('run-1')
    expect(state.session.clearLocalQueuedSubagentSteers).toHaveBeenCalledWith(
      'run-1',
    )
    expect(state.session.completeLocalSubagent).toHaveBeenCalledWith(
      'run-1',
      'Stopped',
      'stopped',
    )
    expect(state.subagents.value[0]?.status).toBe('stopped')
    expect(maybeFlushBackgroundSubagentResume).toHaveBeenCalled()
  })

  it('keeps queued messages and drain suppression after stop', async () => {
    const state = buildState()
    state.messageQueue.items.value = [
      {
        id: 'q-1',
        text: 'queued',
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
      },
    ]
    const { stop } = createLifecycle(state, buildAttention(), {
      send: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    await stop()

    expect(state.suppressQueueDrainAfterStop.value).toBe(true)
    expect(state.messageQueue.items.value).toHaveLength(1)
    expect(state.messageQueue.clear).not.toHaveBeenCalled()

    state.compacting.value = true
    await nextTick()
    state.compacting.value = false
    await nextTick()

    expect(state.suppressQueueDrainAfterStop.value).toBe(true)
    expect(state.messageQueue.items.value).toHaveLength(1)
  })

  it('leaves stop-queue suppression set when force-send does not start a turn', async () => {
    const state = buildState()
    state.messageQueue.items.value = [
      {
        id: 'q-1',
        text: 'queued',
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
      },
    ]
    const send = vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { forceSendQueued } = createLifecycle(state, buildAttention(), {
      send,
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    await forceSendQueued('q-1')

    expect(state.suppressQueueDrainAfterStop.value).toBe(true)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'queued',
        internal: true,
        skipUserMessage: undefined,
        skipUserPersist: undefined,
      }),
    )
  })

  it('force-sends skipUserMessage from a deferred queued item', async () => {
    const state = buildState()
    state.messageQueue.items.value = [
      {
        id: 'q-1',
        text: 'queued',
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
        skipUserMessage: true,
        skipUserPersist: true,
      },
    ]
    const send = vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { forceSendQueued } = createLifecycle(state, buildAttention(), {
      send,
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    await forceSendQueued('q-1')

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'queued',
        internal: true,
        skipUserMessage: true,
        skipUserPersist: true,
      }),
    )
  })

  it('waits for compaction to finish before force-sending', async () => {
    const state = buildState()
    state.compacting.value = true
    state.messageQueue.items.value = [
      {
        id: 'q-1',
        text: 'queued',
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
      },
    ]
    const send = vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { forceSendQueued } = createLifecycle(state, buildAttention(), {
      send,
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    const pending = forceSendQueued('q-1')
    await nextTick()

    expect(send).not.toHaveBeenCalled()

    state.compacting.value = false
    await nextTick()
    await pending

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'queued',
        internal: true,
      }),
    )
  })

  it('does not force-send after dispose while waiting on compaction', async () => {
    const state = buildState()
    state.compacting.value = true
    state.messageQueue.items.value = [
      {
        id: 'q-1',
        text: 'queued',
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
      },
    ]
    const send = vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { forceSendQueued } = createLifecycle(state, buildAttention(), {
      send,
      stopMcpAuthPolling: vi.fn<() => void>(),
      maybeFlushBackgroundSubagentResume: vi.fn<() => void>(),
    })

    const pending = forceSendQueued('q-1')
    await nextTick()
    state.disposed.value = true
    await nextTick()
    await pending

    expect(send).not.toHaveBeenCalled()
  })
})
