import { describe, expect, it } from 'vitest'
import {
  aggregateChatFileDiffs,
  collectMutationsAfterUserMessage,
} from '@/services/harness/restore-file-checkpoints'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { FileDiff, FileDiffOperation } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

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

const todoItem = (): ChatTimelineItem => ({
  type: 'todo',
  todos: [{ id: 'todo-1', content: 'ship', status: 'pending' }],
})

const compactionItem = (): ChatTimelineItem => ({
  type: 'compaction',
  summary: 'compacted',
  focus: null,
})

describe('aggregateChatFileDiffs', () => {
  it('merges changes across multiple agent turns for the same path', () => {
    const changes = aggregateChatFileDiffs([
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 2, 1)],
        }),
      ]),
      agentTurn('t2', [
        run({
          toolCallId: 't2-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 3, 2)],
        }),
      ]),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'update', additions: 5, deletions: 3 },
    ])
  })

  it('includes subagent timeline item edits', () => {
    const changes = aggregateChatFileDiffs([
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 1, 0)],
        }),
      ]),
      makeSubagent('sub-1', [
        run({
          toolCallId: 'sub-tool',
          status: 'done',
          diffs: [diff('b.ts', 'create', 2, 0)],
        }),
      ]),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'update', additions: 1, deletions: 0 },
      { path: 'b.ts', operation: 'create', additions: 2, deletions: 0 },
    ])
  })

  it('resolves operation priority across turns', () => {
    const changes = aggregateChatFileDiffs([
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 1, 1), diff('b.ts', 'create', 2, 0)],
        }),
      ]),
      agentTurn('t2', [
        run({
          toolCallId: 't2-tool',
          status: 'done',
          diffs: [diff('a.ts', 'delete', 0, 3), diff('b.ts', 'update', 1, 1)],
        }),
      ]),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'delete', additions: 1, deletions: 4 },
      { path: 'b.ts', operation: 'update', additions: 3, deletions: 1 },
    ])
  })

  it('ignores user, compaction, and todo items', () => {
    const changes = aggregateChatFileDiffs([
      userItem('u1', 'hello'),
      compactionItem(),
      todoItem(),
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('a.ts', 'create', 1, 0)],
        }),
      ]),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'create', additions: 1, deletions: 0 },
    ])
  })

  it('ignores tools that are not done or have no diffs', () => {
    const changes = aggregateChatFileDiffs([
      agentTurn('t1', [
        run({
          toolCallId: 'running',
          status: 'running',
          diffs: [diff('a.ts', 'update', 1, 0)],
        }),
        run({
          toolCallId: 'error',
          status: 'error',
          diffs: [diff('b.ts', 'update', 1, 0)],
        }),
        run({
          toolCallId: 'rejected',
          status: 'rejected',
          diffs: [diff('c.ts', 'update', 1, 0)],
        }),
        run({
          toolCallId: 'done-empty',
          status: 'done',
          diffs: [],
        }),
        run({
          toolCallId: 'done-missing',
          status: 'done',
        }),
      ]),
      makeSubagent('sub-1', [
        run({
          toolCallId: 'sub-running',
          status: 'running',
          diffs: [diff('d.ts', 'create', 1, 0)],
        }),
      ]),
    ])

    expect(changes).toEqual([])
  })

  it('sorts aggregated results by path', () => {
    const changes = aggregateChatFileDiffs([
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('z.ts', 'update', 1, 0), diff('m.ts', 'create', 1, 0)],
        }),
      ]),
      makeSubagent('sub-1', [
        run({
          toolCallId: 'sub-tool',
          status: 'done',
          diffs: [diff('a.ts', 'create', 1, 0)],
        }),
      ]),
    ])

    expect(changes.map((change) => change.path)).toEqual(['a.ts', 'm.ts', 'z.ts'])
  })
})

describe('collectMutationsAfterUserMessage', () => {
  it('returns an empty list when the user message is missing', () => {
    expect(
      collectMutationsAfterUserMessage(
        [
          userItem('u1', 'hello'),
          agentTurn('t1', [
            run({
              toolCallId: 't1-tool',
              status: 'done',
              diffs: [diff('a.ts', 'update', 1, 0)],
            }),
          ]),
        ],
        'missing',
      ),
    ).toEqual([])
  })

  it('aggregates only items after the boundary user message', () => {
    const timeline: ChatTimelineItem[] = [
      userItem('u1', 'one'),
      agentTurn('t1', [
        run({
          toolCallId: 't1-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 2, 1)],
        }),
      ]),
      userItem('u2', 'two'),
      agentTurn('t2', [
        run({
          toolCallId: 't2-tool',
          status: 'done',
          diffs: [diff('a.ts', 'update', 3, 0), diff('b.ts', 'create', 1, 0)],
        }),
      ]),
    ]

    expect(collectMutationsAfterUserMessage(timeline, 'u2')).toEqual([
      { path: 'a.ts', operation: 'update', additions: 3, deletions: 0 },
      { path: 'b.ts', operation: 'create', additions: 1, deletions: 0 },
    ])
  })
})
