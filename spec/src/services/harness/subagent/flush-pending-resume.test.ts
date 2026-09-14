import { beforeEach, describe, expect, it } from 'vitest'
import flushPendingBackgroundResume from '@/services/harness/subagent/flush-pending-resume'
import {
  getTurnResponseMessages,
  hasPendingBackgroundResume,
  hasRunningSubagentsForChat,
  listDeliverableBackgroundResults,
  register,
  resetSubagentRegistryForTests,
  resolve,
  setTurnResponseMessages,
} from '@/services/harness/subagent/registry'

describe('flushPendingBackgroundResume', () => {
  beforeEach(() => {
    resetSubagentRegistryForTests()
  })

  it('clears the captured turn and does not deliver later results onto a new turn', () => {
    const controller = new AbortController()
    register('chat-1', 'sub-1', controller, {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    setTurnResponseMessages('chat-1', [{ role: 'assistant', content: 'wave-1' }])
    expect(hasPendingBackgroundResume('chat-1')).toBe(true)

    flushPendingBackgroundResume('chat-1')

    expect(getTurnResponseMessages('chat-1')).toBeNull()
    expect(hasPendingBackgroundResume('chat-1')).toBe(false)
    expect(hasRunningSubagentsForChat('chat-1')).toBe(true)
    expect(controller.signal.aborted).toBe(false)

    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'mapped the repo',
    })
    expect(listDeliverableBackgroundResults('chat-1')).toEqual([])
  })

  it('marks already-finished results delivered so a later resume cannot patch them', () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'mapped the repo',
    })
    setTurnResponseMessages('chat-1', [{ role: 'assistant', content: 'wave-1' }])

    flushPendingBackgroundResume('chat-1')

    expect(listDeliverableBackgroundResults('chat-1')).toEqual([])
    expect(getTurnResponseMessages('chat-1')).toBeNull()
    expect(hasPendingBackgroundResume('chat-1')).toBe(false)
  })
})
