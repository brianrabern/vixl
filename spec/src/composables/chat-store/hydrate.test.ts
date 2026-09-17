import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'

const { metaFor } = vi.hoisted(() => {
  const metaFor = (id: string) => ({
    id,
    title: id,
    projectSlug: 'proj',
    projectRoot: '/proj',
    mode: 'agent' as const,
    model: 'test/model',
    status: 'idle' as const,
    attention: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    forkedFrom: null,
    pinned: false,
    pinnedAt: null,
  })
  return { metaFor }
})

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    readChatMeta: vi.fn<
      (_slug: string, chatId: string) => Promise<ReturnType<typeof metaFor>>
    >(async (_slug, chatId) => metaFor(chatId)),
    readChatMessages: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  }),
)

const harnessLine = (id: string, harnessEvent: Record<string, unknown>) => ({
  id,
  role: 'assistant' as const,
  parts: [],
  createdAt: '2020-01-01T00:00:00.000Z',
  harnessEvent,
})

describe('hydrateSessionFromDisk unfinished subagents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks a running subagent as error and closes leftover running tools', async () => {
    const vixl = await import('@/services/vixl/vixl-tauri')
    vi.mocked(vixl.readChatMessages).mockResolvedValue([
      harnessLine('sub-1', {
        type: 'subagent-start',
        subagentId: 'sub-1',
        name: 'explore',
        blocking: false,
      }),
      harnessLine('sub-1-event-1', {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: {
          type: 'tool-start',
          toolCallId: 't-running',
          name: 'read_file',
          args: { path: 'a.ts' },
        },
      }),
      harnessLine('sub-1-event-2', {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: {
          type: 'tool-start',
          toolCallId: 't-done',
          name: 'read_file',
          args: { path: 'b.ts' },
        },
      }),
      harnessLine('sub-1-event-3', {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: {
          type: 'tool-result',
          toolCallId: 't-done',
          result: { content: 'ok' },
          isError: false,
        },
      }),
    ])

    const { createSession } = await import('@/composables/chat-store/helpers')
    const hydrateSessionFromDisk = (await import('@/composables/chat-store/hydrate'))
      .default
    const session = createSession('proj', 'chat-hydrate-subagent')
    await hydrateSessionFromDisk(session)

    const item = session.timeline.value[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('error')
    expect(item.tools).toEqual([
      {
        toolCallId: 't-running',
        name: 'read_file',
        status: 'error',
        args: { path: 'a.ts' },
        result: { error: 'Tool did not complete' },
      },
      {
        toolCallId: 't-done',
        name: 'read_file',
        status: 'done',
        args: { path: 'b.ts' },
        result: { content: 'ok' },
      },
    ])
  })

  it('leaves a completed subagent at its persisted terminal status', async () => {
    const vixl = await import('@/services/vixl/vixl-tauri')
    vi.mocked(vixl.readChatMessages).mockResolvedValue([
      harnessLine('sub-1', {
        type: 'subagent-start',
        subagentId: 'sub-1',
        name: 'explore',
        blocking: false,
      }),
      harnessLine('sub-1-result', {
        type: 'subagent-result',
        subagentId: 'sub-1',
        summary: 'found things',
        outcome: 'completed',
      }),
    ])

    const { createSession } = await import('@/composables/chat-store/helpers')
    const hydrateSessionFromDisk = (await import('@/composables/chat-store/hydrate'))
      .default
    const session = createSession('proj', 'chat-hydrate-done')
    await hydrateSessionFromDisk(session)

    const item = session.timeline.value[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('done')
    expect(item.summary).toBe('found things')
  })
})
