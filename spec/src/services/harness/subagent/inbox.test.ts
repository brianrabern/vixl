import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSteers,
  drainSteers,
  pushSteer,
  resetInboxForTests,
} from '@/services/harness/subagent/inbox'

describe('subagent inbox', () => {
  beforeEach(() => {
    resetInboxForTests()
  })

  it('drains messages in FIFO order', () => {
    pushSteer('sub-1', 'first')
    pushSteer('sub-1', 'second')
    pushSteer('sub-1', 'third')

    expect(drainSteers('sub-1')).toEqual(['first', 'second', 'third'])
    expect(drainSteers('sub-1')).toEqual([])
  })

  it('keeps queues isolated per subagent', () => {
    pushSteer('sub-1', 'one')
    pushSteer('sub-2', 'two')

    expect(drainSteers('sub-1')).toEqual(['one'])
    expect(drainSteers('sub-2')).toEqual(['two'])
  })

  it('clearSteers drops undelivered messages', () => {
    pushSteer('sub-1', 'keep me')
    clearSteers('sub-1')
    expect(drainSteers('sub-1')).toEqual([])
  })
})
