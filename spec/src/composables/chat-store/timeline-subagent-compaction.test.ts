import { describe, expect, it } from 'vitest'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { HarnessEvent } from '@/types/harness/harness-event'
import {
  appendSubagentToolEvent,
  clearQueuedSubagentSteers,
  completeSubagentTimelineItem,
  queueSubagentSteer,
  rollbackQueuedSubagentSteer,
  upsertSubagentStart,
} from '@/composables/chat-store/timeline'

const started = (): ChatTimelineItem[] =>
  upsertSubagentStart([], {
    subagentId: 'sub-1',
    name: 'explore',
    blocking: false,
    prompt: 'look around',
  })

describe('appendSubagentToolEvent compaction', () => {
  it('stores nested compaction on the subagent item without changing tools', () => {
    const withTool = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'tool-start',
      toolCallId: 't1',
      name: 'read_file',
      args: { path: 'a.ts' },
    })
    const next = appendSubagentToolEvent(withTool, 'sub-1', {
      type: 'compaction',
      summary: 'Kept the file reads',
      focus: 'auth',
    })

    expect(next).toHaveLength(1)
    expect(next.some((item) => item.type === 'compaction')).toBe(false)

    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.tools).toEqual([
      {
        toolCallId: 't1',
        name: 'read_file',
        status: 'running',
        args: { path: 'a.ts' },
      },
    ])
    expect(item.compactions).toEqual([
      { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 1 },
    ])
  })

  it('does not append empty summary compaction', () => {
    const next = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'compaction',
      summary: '',
      focus: null,
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.compactions).toEqual([])
    expect(item.tools).toEqual([])
  })

  it('keeps compactions when completing the subagent', () => {
    const compacted = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'compaction',
      summary: 'Prior work summarized',
      focus: null,
    })
    const done = completeSubagentTimelineItem(
      compacted,
      'sub-1',
      'found things',
      'done',
    )
    const item = done[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('done')
    expect(item.compactions).toEqual([
      { summary: 'Prior work summarized', focus: null, toolBoundary: 0 },
    ])
  })

  it('still applies nested tool events after compaction', () => {
    const event: HarnessEvent = {
      type: 'tool-result',
      toolCallId: 't1',
      result: { content: 'ok' },
      isError: false,
    }
    const startedTools = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'tool-start',
      toolCallId: 't1',
      name: 'read_file',
      args: { path: 'a.ts' },
    })
    const compacted = appendSubagentToolEvent(startedTools, 'sub-1', {
      type: 'compaction',
      summary: 'Trimmed earlier reads',
      focus: null,
    })
    const next = appendSubagentToolEvent(compacted, 'sub-1', event)
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.tools).toHaveLength(1)
    expect(item.tools[0]?.status).toBe('done')
    expect(item.compactions).toEqual([
      { summary: 'Trimmed earlier reads', focus: null, toolBoundary: 1 },
    ])
  })

  it('sets compacting on started and clears it on ended', () => {
    const startedFlag = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'compaction-started',
    })
    const startedItem = startedFlag[0]
    expect(startedItem?.type).toBe('subagent')
    if (startedItem?.type !== 'subagent') {
      return
    }
    expect(startedItem.compacting).toBe(true)

    const ended = appendSubagentToolEvent(startedFlag, 'sub-1', {
      type: 'compaction-ended',
    })
    const endedItem = ended[0]
    expect(endedItem?.type).toBe('subagent')
    if (endedItem?.type !== 'subagent') {
      return
    }
    expect(endedItem.compacting).toBe(false)
    expect(endedItem.compactions).toEqual([])
  })

  it('clears compacting when a nested compaction lands', () => {
    const pending = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'compaction-started',
    })
    const next = appendSubagentToolEvent(pending, 'sub-1', {
      type: 'compaction',
      summary: 'Kept the file reads',
      focus: 'auth',
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.compacting).toBe(false)
    expect(item.compactions).toEqual([
      { summary: 'Kept the file reads', focus: 'auth', toolBoundary: 0 },
    ])
  })
})

describe('appendSubagentToolEvent steer and history', () => {
  it('marks a finished subagent running when a steer arrives', () => {
    const done = completeSubagentTimelineItem(
      started(),
      'sub-1',
      'first pass',
      'done',
    )
    const next = appendSubagentToolEvent(done, 'sub-1', {
      type: 'subagent-steer',
      message: 'keep going',
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('running')
    expect(item.steers).toEqual([{ message: 'keep going', toolBoundary: 0 }])
    expect(item.pendingSteers).toEqual([])
    expect(item.tools).toEqual([])
  })

  it('records a steer toolBoundary equal to the tool count at steer time', () => {
    const withTool = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'tool-start',
      toolCallId: 't1',
      name: 'read_file',
      args: { path: 'a.ts' },
    })
    const next = appendSubagentToolEvent(withTool, 'sub-1', {
      type: 'subagent-steer',
      message: 'keep going',
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.steers).toEqual([{ message: 'keep going', toolBoundary: 1 }])
    expect(item.tools).toHaveLength(1)
  })

  it('consumes a matching pending steer without duplicating the message', () => {
    const queued = started()
    const withPending = queued.map((item) =>
      item.type === 'subagent'
        ? { ...item, pendingSteers: ['keep going'] }
        : item,
    )
    const next = appendSubagentToolEvent(withPending, 'sub-1', {
      type: 'subagent-steer',
      message: 'keep going',
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.steers).toEqual([{ message: 'keep going', toolBoundary: 0 }])
    expect(item.pendingSteers).toEqual([])
  })

  it('stores persisted conversation messages on the timeline item', () => {
    const next = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'subagent-history',
      messages: [
        { role: 'user', content: 'task' },
        { role: 'assistant', content: 'done' },
      ],
    })
    const item = next[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.messages).toEqual([
      { role: 'user', content: 'task' },
      { role: 'assistant', content: 'done' },
    ])
  })
})

describe('queueSubagentSteer and rollback', () => {
  it('queues a pending steer and marks the item running', () => {
    const done = completeSubagentTimelineItem(
      started(),
      'sub-1',
      'first pass',
      'done',
    )
    const queued = queueSubagentSteer(done, 'sub-1', 'keep going')
    const item = queued[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('running')
    expect(item.pendingSteers).toEqual(['keep going'])
  })

  it('drops the queued steer and restores the prior status', () => {
    const done = completeSubagentTimelineItem(
      started(),
      'sub-1',
      'first pass',
      'done',
    )
    const queued = queueSubagentSteer(done, 'sub-1', 'keep going')
    const rolled = rollbackQueuedSubagentSteer(
      queued,
      'sub-1',
      'keep going',
      'done',
    )
    const item = rolled[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('done')
    expect(item.pendingSteers).toEqual([])
  })

  it('clears undelivered pending steers and keeps delivered steers', () => {
    const done = completeSubagentTimelineItem(
      started(),
      'sub-1',
      'first pass',
      'done',
    )
    const withSteer = appendSubagentToolEvent(done, 'sub-1', {
      type: 'subagent-steer',
      message: 'keep going',
    })
    const queued = queueSubagentSteer(withSteer, 'sub-1', 'then fix lint')
    const cleared = clearQueuedSubagentSteers(queued, 'sub-1')
    const item = cleared[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.steers).toEqual([{ message: 'keep going', toolBoundary: 0 }])
    expect(item.pendingSteers).toEqual([])
  })
})

describe('completeSubagentTimelineItem leftover tools', () => {
  it('closes leftover running tools to error and leaves terminal tools untouched', () => {
    const withRunning = appendSubagentToolEvent(started(), 'sub-1', {
      type: 'tool-start',
      toolCallId: 't-running',
      name: 'read_file',
      args: { path: 'a.ts' },
    })
    const withDone = appendSubagentToolEvent(withRunning, 'sub-1', {
      type: 'tool-start',
      toolCallId: 't-done',
      name: 'read_file',
      args: { path: 'b.ts' },
    })
    const doneResult = appendSubagentToolEvent(withDone, 'sub-1', {
      type: 'tool-result',
      toolCallId: 't-done',
      result: { content: 'ok' },
      isError: false,
    })
    const withError = appendSubagentToolEvent(doneResult, 'sub-1', {
      type: 'tool-start',
      toolCallId: 't-error',
      name: 'read_file',
      args: { path: 'c.ts' },
    })
    const errorResult = appendSubagentToolEvent(withError, 'sub-1', {
      type: 'tool-result',
      toolCallId: 't-error',
      result: { error: 'boom' },
      isError: true,
    })
    const completed = completeSubagentTimelineItem(
      errorResult,
      'sub-1',
      'first pass',
      'error',
    )
    const item = completed[0]
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
      {
        toolCallId: 't-error',
        name: 'read_file',
        status: 'error',
        args: { path: 'c.ts' },
        result: { error: 'boom' },
      },
    ])
  })
})

describe('upsertSubagentStart existing item', () => {
  it('resets status to running when the same subagent starts again', () => {
    const done = completeSubagentTimelineItem(
      started(),
      'sub-1',
      'first pass',
      'done',
    )
    const reopened = upsertSubagentStart(done, {
      subagentId: 'sub-1',
      name: 'explore',
      blocking: false,
      prompt: 'look around',
    })
    const item = reopened[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.status).toBe('running')
    expect(item.summary).toBe('first pass')
  })
})
