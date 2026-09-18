import { describe, expect, it } from 'vitest'
import {
  aggregateSubagentFileDiffs,
  aggregateTurnFileDiffs,
  collectMutationsAfterUserMessage,
  resolveBaselinesForRevert,
  summarizeMutationCounts,
} from '@/services/harness/restore-file-checkpoints'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type {
  ChatTimelineItem,
  SubagentTimelineItem,
} from '@/types/chat/chat-timeline-item'
import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'
import type { FileDiff } from '@/types/harness/file-diff'

const makeTurn = (id: string, diffs: AgentTurn['steps'][0]['tools'][0]['diffs']): AgentTurn => ({
  id,
  text: '',
  steps: [
    {
      id: `${id}-step`,
      text: '',
      reasoning: '',
      tools: [
        {
          toolCallId: `${id}-tool`,
          name: 'write_file',
          status: 'done',
          diffs,
        },
      ],
    },
  ],
})

const pathDiff = (path: string, operation: FileDiff['operation']): FileDiff => ({
  path,
  operation,
  hunks: [],
})

const makeSubagent = (
  id: string,
  diffs: FileDiff[],
): SubagentTimelineItem => ({
  type: 'subagent',
  subagentId: id,
  name: 'explore',
  blocking: false,
  status: 'done',
  tools: [
    {
      toolCallId: `${id}-tool`,
      name: 'write_file',
      status: 'done',
      diffs,
    },
  ],
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

describe('restore-file-checkpoints aggregation', () => {
  it('aggregates turn diffs by path', () => {
    const turn = makeTurn('t1', [
      {
        path: 'a.ts',
        operation: 'update',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [
              { kind: 'remove', content: 'old' },
              { kind: 'add', content: 'new' },
            ],
          },
        ],
      },
      {
        path: 'b.ts',
        operation: 'create',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [{ kind: 'add', content: 'x' }],
          },
        ],
      },
    ])

    const changes = aggregateTurnFileDiffs(turn)
    expect(changes).toHaveLength(2)
    expect(changes.map((item) => item.path)).toEqual(['a.ts', 'b.ts'])
    expect(summarizeMutationCounts(changes)).toMatchObject({
      files: 2,
      created: 1,
      updated: 1,
    })
  })

  it('collects mutations after a user message and resolves baselines', () => {
    const timeline: ChatTimelineItem[] = [
      {
        type: 'user',
        message: {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'one' }],
        },
      },
      {
        type: 'agent-turn',
        turn: makeTurn('t1', [
          {
            path: 'a.ts',
            operation: 'update',
            hunks: [],
          },
        ]),
      },
      {
        type: 'user',
        message: {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'two' }],
        },
      },
      {
        type: 'agent-turn',
        turn: makeTurn('t2', [
          {
            path: 'a.ts',
            operation: 'update',
            hunks: [],
          },
          {
            path: 'c.ts',
            operation: 'create',
            hunks: [],
          },
        ]),
      },
    ]

    const afterU1 = collectMutationsAfterUserMessage(timeline, 'u1')
    expect(afterU1.map((item) => item.path).sort()).toEqual(['a.ts', 'c.ts'])

    const targets = resolveBaselinesForRevert(timeline, 'u1')
    expect(targets).toEqual([
      { path: 'a.ts', userMessageId: 'u1' },
      { path: 'c.ts', userMessageId: 'u2' },
    ])
  })

  it('folds subagent diffs after the boundary user message', () => {
    const timeline: ChatTimelineItem[] = [
      userItem('u1', 'one'),
      {
        type: 'agent-turn',
        turn: makeTurn('t1', [pathDiff('a.ts', 'update')]),
      },
      makeSubagent('sub-1', [pathDiff('b.ts', 'create')]),
      userItem('u2', 'two'),
      {
        type: 'agent-turn',
        turn: makeTurn('t2', [pathDiff('c.ts', 'create')]),
      },
    ]

    const afterU1 = collectMutationsAfterUserMessage(timeline, 'u1')
    expect(afterU1.map((item) => item.path)).toEqual(['a.ts', 'b.ts', 'c.ts'])

    const afterU2 = collectMutationsAfterUserMessage(timeline, 'u2')
    expect(afterU2.map((item) => item.path)).toEqual(['c.ts'])
  })

  it('attributes a subagent-only path to the user message in effect', () => {
    const timeline: ChatTimelineItem[] = [
      userItem('u1', 'one'),
      {
        type: 'agent-turn',
        turn: makeTurn('t1', [pathDiff('a.ts', 'update')]),
      },
      userItem('u2', 'two'),
      makeSubagent('sub-1', [pathDiff('d.ts', 'create')]),
    ]

    const targets = resolveBaselinesForRevert(timeline, 'u1')
    expect(targets).toEqual([
      { path: 'a.ts', userMessageId: 'u1' },
      { path: 'd.ts', userMessageId: 'u2' },
    ])
  })

  it('aggregates subagent tools and folds into an existing list', () => {
    const existing: AggregatedTurnFileChange[] = [
      { path: 'a.ts', operation: 'create', additions: 1, deletions: 0 },
    ]
    const subagent = makeSubagent('sub-1', [
      {
        path: 'a.ts',
        operation: 'update',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [{ kind: 'add', content: 'x' }],
          },
        ],
      },
      pathDiff('b.ts', 'create'),
    ])

    const changes = aggregateSubagentFileDiffs(subagent, existing)
    expect(changes).toEqual([
      { path: 'a.ts', operation: 'update', additions: 2, deletions: 0 },
      { path: 'b.ts', operation: 'create', additions: 0, deletions: 0 },
    ])
  })
})
