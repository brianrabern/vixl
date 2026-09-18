import { describe, expect, it } from 'vitest'
import { noPoll, visibleStatus } from '@/services/harness/guidance'

describe('harness guidance clauses', () => {
  it('forbids polling and says the harness resumes as each background subagent finishes', () => {
    expect(noPoll).toContain('Do not poll with terminal_output')
    expect(noPoll).toContain('End your turn')
    expect(noPoll).toContain('as each background subagent finishes')
  })

  it('requires a one-line visible status for spawned, steered, and finished work', () => {
    expect(visibleStatus('spawned')).toContain(
      'what you spawned, what is still running, and what happens next',
    )
    expect(visibleStatus('steered')).toContain(
      'what you steered, what is still running, and what happens next',
    )
    expect(visibleStatus('finished')).toContain(
      'what finished, what is still running, and what happens next',
    )
  })
})
