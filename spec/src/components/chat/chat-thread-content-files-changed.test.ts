import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, type VueWrapper } from '@vue/test-utils'

vi.hoisted(() => {
  Object.defineProperty(document, 'queryCommandSupported', {
    configurable: true,
    value: () => false,
  })
})

import ChatAgentTurn from '@/components/chat/ChatAgentTurn.vue'
import ChatThreadContent from '@/components/chat/ChatThreadContent.vue'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { FileDiff, FileDiffOperation } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const scroller = vi.hoisted(() => ({
  scrollToEnd: vi.fn<(...args: unknown[]) => void>(),
  handleContentChange: vi.fn<() => void>(),
}))

vi.mock('@/components/shadcn/ui/message-scroller/useMessageScroller', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/components/shadcn/ui/message-scroller/useMessageScroller')
    >()
  return {
    ...actual,
    useMessageScroller: () => ({
      scrollToEnd: scroller.scrollToEnd,
      scrollToMessage: vi.fn<(...args: unknown[]) => void>(),
      scrollToStart: vi.fn<(...args: unknown[]) => void>(),
    }),
    useMessageScrollerContext: () => ({
      handleContentChange: scroller.handleContentChange,
      scrollToEnd: scroller.scrollToEnd,
    }),
  }
})

const diff = (
  path: string,
  operation: FileDiffOperation,
  additions: number,
  deletions: number,
): FileDiff => ({
  path,
  operation,
  hunks: [
    {
      oldStart: 1,
      newStart: 1,
      lines: [
        ...Array.from({ length: deletions }, () => ({
          kind: 'remove' as const,
          content: 'old',
        })),
        ...Array.from({ length: additions }, () => ({
          kind: 'add' as const,
          content: 'new',
        })),
      ],
    },
  ],
})

const run = (
  partial: Partial<ToolRun> & Pick<ToolRun, 'toolCallId' | 'status'>,
): ToolRun => ({
  name: 'edit_file',
  ...partial,
})

const makeTurn = (id: string, tools: ToolRun[]): AgentTurn => ({
  id,
  text: '',
  steps: [
    {
      id: `${id}-step`,
      text: '',
      reasoning: '',
      tools,
    },
  ],
})

const agentTurn = (id: string, tools: ToolRun[]): ChatTimelineItem => ({
  type: 'agent-turn',
  turn: makeTurn(id, tools),
})

const makeSubagent = (id: string, tools: ToolRun[]): SubagentTimelineItem => ({
  type: 'subagent',
  subagentId: id,
  name: 'explore',
  blocking: false,
  status: 'done',
  tools,
  compactions: [],
})

const userItem = (id: string, text: string): ChatTimelineItem => ({
  type: 'user',
  message: {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  },
})

const editRun = (toolCallId: string, path: string): ToolRun =>
  run({
    toolCallId,
    status: 'done',
    diffs: [diff(path, path === 'c.ts' ? 'create' : 'update', 1, 0)],
  })

const agentTurnStub = {
  name: 'ChatAgentTurn',
  props: [
    'turn',
    'status',
    'activityLabel',
    'subagentsByToolCallId',
    'subagentsById',
    'restoreEnabled',
    'chatFileChanges',
    'restoreChanges',
    'restoreDiscardsLatestMessage',
  ],
  template: '<div data-testid="agent-turn" />',
}

let wrapper: VueWrapper | null = null

const mountContent = (timeline: ChatTimelineItem[]): VueWrapper => {
  wrapper = shallowMount(ChatThreadContent, {
    props: {
      timeline,
      pendingApprovals: [],
      status: 'ready',
    },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        ChatAgentTurn: agentTurnStub,
        ChatMessageTurn: true,
        ChatSubAgentTurn: true,
        ChatCompactionMarker: true,
        ChatQuestionCard: true,
        ChatMcpAuthCard: true,
        AiElementsShimmerShimmer: {
          name: 'AiElementsShimmerShimmer',
          template: '<span><slot /></span>',
        },
        MessageScroller: { name: 'MessageScroller', template: '<div><slot /></div>' },
        MessageScrollerViewport: {
          name: 'MessageScrollerViewport',
          template: '<div><slot /></div>',
        },
        MessageScrollerContent: {
          name: 'MessageScrollerContent',
          template: '<div><slot /></div>',
        },
        MessageScrollerItem: {
          name: 'MessageScrollerItem',
          template: '<div><slot /></div>',
        },
      },
    },
  })
  return wrapper
}

const agentTurns = (mounted: VueWrapper) => {
  const byRef = mounted.findAllComponents(ChatAgentTurn)
  if (byRef.length > 0) {
    return byRef
  }
  return mounted.findAllComponents({ name: 'ChatAgentTurn' })
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ChatThreadContent files changed', () => {
  it('passes chatFileChanges only to the last visible agent turn', () => {
    const mounted = mountContent([
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      agentTurn('t2', [editRun('t2-tool', 'b.ts')]),
      userItem('u1', 'thanks'),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.props('turn')).toMatchObject({ id: 't1' })
    expect(turns[0]?.props('chatFileChanges')).toBeNull()
    expect(turns[1]?.props('turn')).toMatchObject({ id: 't2' })
    expect(turns[1]?.props('chatFileChanges')).not.toBeNull()
  })

  it('passes a cumulative aggregate across turns and subagent items', () => {
    const mounted = mountContent([
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      makeSubagent('sub-1', [editRun('sub-tool', 'c.ts')]),
      agentTurn('t2', [editRun('t2-tool', 'b.ts')]),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.props('chatFileChanges')).toBeNull()
    expect(turns[1]?.props('chatFileChanges')).toEqual([
      { path: 'a.ts', operation: 'update', additions: 1, deletions: 0 },
      { path: 'b.ts', operation: 'update', additions: 1, deletions: 0 },
      { path: 'c.ts', operation: 'create', additions: 1, deletions: 0 },
    ])
  })

  it('passes restoreChanges covering both agent turns after one user message', () => {
    const mounted = mountContent([
      userItem('u1', 'do both'),
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      agentTurn('t2', [editRun('t2-tool', 'b.ts')]),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.props('restoreChanges')).toBeUndefined()
    expect(turns[1]?.props('restoreChanges')).toEqual([
      { path: 'a.ts', operation: 'update', additions: 1, deletions: 0 },
      { path: 'b.ts', operation: 'update', additions: 1, deletions: 0 },
    ])
    expect(turns[0]?.props('restoreEnabled')).toBe(true)
    expect(turns[1]?.props('restoreEnabled')).toBe(true)
  })

  it('disables restore when the last agent turn has no preceding user message', () => {
    const mounted = mountContent([
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.props('restoreEnabled')).toBe(false)
    expect(turns[0]?.props('restoreChanges')).toBeUndefined()
  })

  it('excludes paths from an earlier user message when computing restoreChanges', () => {
    const mounted = mountContent([
      userItem('u1', 'first'),
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      userItem('u2', 'second'),
      agentTurn('t2', [editRun('t2-tool', 'b.ts')]),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.props('restoreChanges')).toBeUndefined()
    expect(turns[1]?.props('restoreChanges')).toEqual([
      { path: 'b.ts', operation: 'update', additions: 1, deletions: 0 },
    ])
  })

  it('disables restore when the last agent turn made no file edits', () => {
    const mounted = mountContent([
      userItem('u1', 'first'),
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      userItem('u2', 'second'),
      agentTurn('t2', []),
    ])

    const turns = agentTurns(mounted)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.props('restoreChanges')).toBeUndefined()
    expect(turns[1]?.props('restoreEnabled')).toBe(false)
    expect(turns[1]?.props('restoreChanges')).toEqual([])
    expect(turns[1]?.props('chatFileChanges')).toEqual([
      { path: 'a.ts', operation: 'update', additions: 1, deletions: 0 },
    ])
  })

  it('marks restoreDiscardsLatestMessage when a user message follows the last agent turn', () => {
    const withTrailingUser = mountContent([
      userItem('u1', 'do work'),
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
      userItem('u2', 'stopped before a reply'),
    ])

    const trailingTurns = agentTurns(withTrailingUser)
    expect(trailingTurns).toHaveLength(1)
    expect(trailingTurns[0]?.props('restoreDiscardsLatestMessage')).toBe(true)
    withTrailingUser.unmount()

    const withoutTrailingUser = mountContent([
      userItem('u1', 'do work'),
      agentTurn('t1', [editRun('t1-tool', 'a.ts')]),
    ])

    const lastTurns = agentTurns(withoutTrailingUser)
    expect(lastTurns).toHaveLength(1)
    expect(lastTurns[0]?.props('restoreDiscardsLatestMessage')).toBe(false)
  })
})
