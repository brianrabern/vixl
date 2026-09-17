import { describe, expect, it } from 'vitest'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'
import buildSubagentTimeline from '@/utils/build-subagent-timeline'

const tool = (toolCallId: string, name = 'read_file'): ToolRun => ({
  toolCallId,
  name,
  status: 'done',
  args: { path: `${toolCallId}.ts` },
})

const subagent = (
  partial: Partial<SubagentTimelineItem> = {},
): SubagentTimelineItem => ({
  type: 'subagent',
  subagentId: 'sub-1',
  name: 'explore',
  blocking: false,
  status: 'done',
  prompt: 'look around',
  summary: 'found things',
  tools: [tool('t1')],
  compactions: [],
  ...partial,
})

const agentTurnToolIds = (
  items: ReturnType<typeof buildSubagentTimeline>,
  index: number,
): string[] | undefined => {
  const item = items[index]
  if (item?.type !== 'agent-turn') {
    return undefined
  }
  return item.turn.steps[0]?.tools.map((run) => run.toolCallId)
}

describe('buildSubagentTimeline', () => {
  it('places compaction items between the prompt and the agent turn', () => {
    const items = buildSubagentTimeline(
      subagent({
        compactions: [
          { summary: 'First compact', focus: 'auth', toolBoundary: 0 },
          { summary: 'Second compact', focus: null, toolBoundary: 0 },
        ],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'compaction',
      'compaction',
      'agent-turn',
    ])
    expect(items[1]).toEqual({
      type: 'compaction',
      summary: 'First compact',
      focus: 'auth',
    })
    expect(items[2]).toEqual({
      type: 'compaction',
      summary: 'Second compact',
      focus: null,
    })
  })

  it('omits compaction items when the list is empty', () => {
    const items = buildSubagentTimeline(subagent())
    expect(items.map((item) => item.type)).toEqual(['user', 'agent-turn'])
  })

  it('keeps a single turn with all tools when there are no compactions', () => {
    const items = buildSubagentTimeline(subagent())
    const turnItem = items[1]
    expect(turnItem?.type).toBe('agent-turn')
    if (turnItem?.type !== 'agent-turn') {
      return
    }
    expect(turnItem.turn.id).toBe('sub-1-turn')
    expect(turnItem.turn.text).toBe('found things')
    expect(turnItem.turn.steps[0]?.tools.map((run) => run.toolCallId)).toEqual([
      't1',
    ])
  })

  it('splits tools around each compaction marker in order', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep')],
        compactions: [
          { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 1 },
        ],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'compaction',
      'agent-turn',
    ])

    const preTurn = items[1]
    expect(preTurn?.type).toBe('agent-turn')
    if (preTurn?.type !== 'agent-turn') {
      return
    }
    expect(preTurn.turn.id).toBe('sub-1-turn-0')
    expect(preTurn.turn.text).toBe('')
    expect(preTurn.turn.steps[0]?.tools.map((run) => run.toolCallId)).toEqual([
      't1',
    ])

    expect(items[2]).toEqual({
      type: 'compaction',
      summary: 'Kept the file reads',
      focus: 'auth',
    })

    const postTurn = items[3]
    expect(postTurn?.type).toBe('agent-turn')
    if (postTurn?.type !== 'agent-turn') {
      return
    }
    expect(postTurn.turn.id).toBe('sub-1-turn-1')
    expect(postTurn.turn.text).toBe('found things')
    expect(postTurn.turn.steps[0]?.tools.map((run) => run.toolCallId)).toEqual([
      't2',
    ])
  })

  it('places a delivered steer after the pre-steer turn and pending steers last', () => {
    const items = buildSubagentTimeline(
      subagent({
        steers: [{ message: 'check tests', toolBoundary: 1 }],
        pendingSteers: ['then fix lint'],
      }),
    )
    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'user',
      'agent-turn',
      'user',
    ])
    const firstSteer = items[2]
    expect(firstSteer?.type).toBe('user')
    if (firstSteer?.type !== 'user') {
      return
    }
    expect(firstSteer.message.id).toBe('sub-1-steer-0')
    expect(firstSteer.message.parts).toEqual([
      { type: 'text', text: 'check tests' },
    ])
    const pendingSteer = items[4]
    expect(pendingSteer?.type).toBe('user')
    if (pendingSteer?.type !== 'user') {
      return
    }
    expect(pendingSteer.message.id).toBe('sub-1-steer-1')
    expect(pendingSteer.message.parts).toEqual([
      { type: 'text', text: 'then fix lint' },
    ])
  })

  it('splits tools around a delivered steer', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep'), tool('t3', 'read_file')],
        steers: [{ message: 'try another path', toolBoundary: 2 }],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'user',
      'agent-turn',
    ])
    expect(agentTurnToolIds(items, 1)).toEqual(['t1', 't2'])
    const steer = items[2]
    expect(steer?.type).toBe('user')
    if (steer?.type !== 'user') {
      return
    }
    expect(steer.message.id).toBe('sub-1-steer-0')
    expect(steer.message.parts).toEqual([
      { type: 'text', text: 'try another path' },
    ])
    expect(agentTurnToolIds(items, 3)).toEqual(['t3'])
    const postTurn = items[3]
    expect(postTurn?.type).toBe('agent-turn')
    if (postTurn?.type !== 'agent-turn') {
      return
    }
    expect(postTurn.turn.id).toBe('sub-1-turn-1')
    expect(postTurn.turn.text).toBe('found things')
  })

  it('splits tools around multiple delivered steers in order', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep'), tool('t3', 'read_file')],
        steers: [
          { message: 'look at tests', toolBoundary: 1 },
          { message: 'then lint', toolBoundary: 2 },
        ],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'user',
      'agent-turn',
      'user',
      'agent-turn',
    ])
    expect(agentTurnToolIds(items, 1)).toEqual(['t1'])
    const firstSteer = items[2]
    expect(firstSteer?.type).toBe('user')
    if (firstSteer?.type !== 'user') {
      return
    }
    expect(firstSteer.message.id).toBe('sub-1-steer-0')
    expect(agentTurnToolIds(items, 3)).toEqual(['t2'])
    const secondSteer = items[4]
    expect(secondSteer?.type).toBe('user')
    if (secondSteer?.type !== 'user') {
      return
    }
    expect(secondSteer.message.id).toBe('sub-1-steer-1')
    expect(agentTurnToolIds(items, 5)).toEqual(['t3'])
  })

  it('orders a steer and a compaction by toolBoundary', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep'), tool('t3', 'read_file')],
        compactions: [
          { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 1 },
        ],
        steers: [{ message: 'keep going', toolBoundary: 2 }],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'compaction',
      'agent-turn',
      'user',
      'agent-turn',
    ])
    expect(agentTurnToolIds(items, 1)).toEqual(['t1'])
    expect(items[2]).toEqual({
      type: 'compaction',
      summary: 'Kept the file reads',
      focus: 'auth',
    })
    expect(agentTurnToolIds(items, 3)).toEqual(['t2'])
    const steer = items[4]
    expect(steer?.type).toBe('user')
    if (steer?.type !== 'user') {
      return
    }
    expect(steer.message.parts).toEqual([{ type: 'text', text: 'keep going' }])
    expect(agentTurnToolIds(items, 5)).toEqual(['t3'])
  })

  it('renders a same-boundary steer before the compaction marker', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep')],
        compactions: [
          { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 1 },
        ],
        steers: [{ message: 'keep going', toolBoundary: 1 }],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'user',
      'compaction',
      'agent-turn',
    ])
    expect(agentTurnToolIds(items, 1)).toEqual(['t1'])
    const steer = items[2]
    expect(steer?.type).toBe('user')
    if (steer?.type !== 'user') {
      return
    }
    expect(steer.message.parts).toEqual([{ type: 'text', text: 'keep going' }])
    expect(items[3]).toEqual({
      type: 'compaction',
      summary: 'Kept the file reads',
      focus: 'auth',
    })
    expect(agentTurnToolIds(items, 4)).toEqual(['t2'])
  })

  it('renders pending steers last after post-steer tools', () => {
    const items = buildSubagentTimeline(
      subagent({
        tools: [tool('t1'), tool('t2', 'grep'), tool('t3', 'read_file')],
        steers: [{ message: 'try another path', toolBoundary: 2 }],
        pendingSteers: ['and also check types'],
      }),
    )

    expect(items.map((item) => item.type)).toEqual([
      'user',
      'agent-turn',
      'user',
      'agent-turn',
      'user',
    ])
    expect(agentTurnToolIds(items, 1)).toEqual(['t1', 't2'])
    expect(agentTurnToolIds(items, 3)).toEqual(['t3'])
    const pendingSteer = items[4]
    expect(pendingSteer?.type).toBe('user')
    if (pendingSteer?.type !== 'user') {
      return
    }
    expect(pendingSteer.message.id).toBe('sub-1-steer-1')
    expect(pendingSteer.message.parts).toEqual([
      { type: 'text', text: 'and also check types' },
    ])
  })
})
