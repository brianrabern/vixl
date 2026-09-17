import { describe, expect, it } from 'vitest'
import applyHydrateHarnessEvent, {
  type HydrateAccumulator,
} from '@/composables/chat-store/hydrate-harness'
import { createFlushTurn } from '@/composables/chat-store/hydrate-lines'
import hydrateTimelineBuilder from '@/composables/chat-store/hydrate-timeline-builder'

const emptyAcc = (): HydrateAccumulator => hydrateTimelineBuilder.createAccumulator()

const noopFlush = (): void => {}

describe('hydrate-harness subagent-start', () => {
  it('ignores a persisted description and keeps agentName', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-1',
        toolCallId: 'call-1',
        name: 'explorer',
        description: 'Scan auth helpers',
        blocking: true,
      },
      noopFlush,
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.name).toBe('explorer')
    expect('description' in item).toBe(false)
  })

  it('hydrates old records without description using agentName', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-legacy',
        toolCallId: 'call-legacy',
        name: 'generalPurpose',
        blocking: false,
      },
      noopFlush,
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.name).toBe('generalPurpose')
    expect('description' in item).toBe(false)
  })
})

describe('hydrate-harness todo-update', () => {
  it('replaces the last todo item instead of appending another', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'todo-update',
        todos: [{ id: 't1', content: 'one', status: 'pending' }],
      },
      noopFlush,
    )
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'todo-update',
        todos: [{ id: 't1', content: 'one done', status: 'completed' }],
      },
      noopFlush,
    )
    expect(acc.nextTimeline).toHaveLength(1)
    expect(acc.nextTimeline[0]).toEqual({
      type: 'todo',
      todos: [{ id: 't1', content: 'one done', status: 'completed' }],
    })
  })
})

describe('hydrate-harness tool-run', () => {
  it('upserts a later tool-run into the committed turn that owns the toolCallId', () => {
    const acc = emptyAcc()
    const flushTurn = createFlushTurn(acc)
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-1',
        name: 'read_file',
        status: 'done',
        args: { path: 'a.ts' },
        stepId: 'step-1',
      },
      flushTurn,
    )
    flushTurn()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-1',
        name: 'read_file',
        status: 'done',
        result: { content: 'ok' },
        stepId: 'step-2',
      },
      flushTurn,
    )
    flushTurn()

    const turns = acc.nextTimeline.filter((item) => item.type === 'agent-turn')
    expect(turns).toHaveLength(1)
    const turn = turns[0]
    expect(turn?.type).toBe('agent-turn')
    if (turn?.type !== 'agent-turn') {
      return
    }
    const tools = turn.turn.steps.flatMap((step) => step.tools)
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({
      toolCallId: 'tc-1',
      name: 'read_file',
      status: 'done',
      args: { path: 'a.ts' },
      result: { content: 'ok' },
    })
  })

  it('does not flip a committed done tool back to running', () => {
    const acc = emptyAcc()
    const flushTurn = createFlushTurn(acc)
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-1',
        name: 'read_file',
        status: 'done',
        args: { path: 'a.ts' },
        result: { content: 'ok' },
      },
      flushTurn,
    )
    flushTurn()
    const patched = hydrateTimelineBuilder.upsertCommittedTool(acc, {
      toolCallId: 'tc-1',
      name: 'read_file',
      status: 'running',
      args: { path: 'a.ts' },
    })
    expect(patched).toBe(true)
    const turn = acc.nextTimeline[0]
    expect(turn?.type).toBe('agent-turn')
    if (turn?.type !== 'agent-turn') {
      return
    }
    expect(turn.turn.steps[0]?.tools[0]).toMatchObject({
      toolCallId: 'tc-1',
      status: 'done',
      result: { content: 'ok' },
    })
  })

  it('treats a persisted running tool-run as an error', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-open',
        name: 'read_file',
        status: 'running',
        args: { path: 'a.ts' },
      },
      noopFlush,
    )
    expect(acc.pendingTurn?.steps[0]?.tools[0]).toMatchObject({
      toolCallId: 'tc-open',
      status: 'error',
      result: { error: 'Tool did not complete' },
    })
  })

  it('uses the legacy-step fallback when no current step exists', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-legacy',
        name: 'read_file',
        status: 'done',
        args: { path: 'a.ts' },
      },
      noopFlush,
    )
    expect(acc.currentStepId).toBe('legacy-step')
    expect(acc.pendingTurn?.id).toBe('tc-legacy')
    expect(acc.pendingTurn?.steps[0]?.id).toBe('legacy-step')
    expect(acc.pendingTurn?.steps[0]?.tools[0]?.toolCallId).toBe('tc-legacy')
  })
})

describe('hydrate-harness subagent-event', () => {
  it('shifts a matching pending steer when the nested steer lands', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-1',
        name: 'explore',
        blocking: false,
      },
      noopFlush,
    )
    const started = acc.nextTimeline[0]
    expect(started?.type).toBe('subagent')
    if (started?.type !== 'subagent') {
      return
    }
    acc.nextTimeline[0] = { ...started, pendingSteers: ['keep going'] }
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: { type: 'subagent-steer', message: 'keep going' },
      },
      noopFlush,
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('running')
    expect(item.steers).toEqual([{ message: 'keep going', toolBoundary: 0 }])
    expect(item.pendingSteers).toEqual([])
  })

  it('stores nested compaction with a toolBoundary equal to the tool count', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-1',
        name: 'explore',
        blocking: false,
      },
      noopFlush,
    )
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: {
          type: 'tool-start',
          toolCallId: 't1',
          name: 'read_file',
          args: { path: 'a.ts' },
        },
      },
      noopFlush,
    )
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-event',
        subagentId: 'sub-1',
        event: { type: 'compaction', summary: 'Kept the file reads', focus: 'auth' },
      },
      noopFlush,
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.compactions).toEqual([
      { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 1 },
    ])
    expect(item.compacting).toBe(false)
  })
})

describe('hydrate-harness pending subagents', () => {
  it('merges pending subagents on flush and keeps later events on that item', () => {
    const acc = emptyAcc()
    const flushTurn = createFlushTurn(acc)
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'tool-run',
        toolCallId: 'tc-parent',
        name: 'spawn_subagent',
        status: 'done',
        stepId: 'step-1',
      },
      flushTurn,
    )
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-1',
        name: 'explore',
        blocking: false,
        prompt: 'look around',
      },
      flushTurn,
    )
    expect(acc.pendingSubagents).toHaveLength(1)
    expect(acc.nextTimeline).toHaveLength(0)
    flushTurn()
    expect(acc.pendingSubagents).toHaveLength(0)
    expect(acc.nextTimeline.map((item) => item.type)).toEqual(['agent-turn', 'subagent'])
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'pending-subagent',
        subagentId: 'sub-1',
        prompt: 'look around harder',
      },
      flushTurn,
    )
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-result',
        subagentId: 'sub-1',
        summary: 'found things',
        outcome: 'completed',
      },
      flushTurn,
    )
    const item = acc.nextTimeline[1]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.prompt).toBe('look around harder')
    expect(item.status).toBe('done')
    expect(item.summary).toBe('found things')
  })
})
