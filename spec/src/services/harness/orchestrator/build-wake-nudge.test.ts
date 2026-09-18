import { describe, expect, it } from 'vitest'
import { visibleStatus } from '@/services/harness/guidance'
import buildWakeNudge from '@/services/harness/orchestrator/build-wake-nudge'

const explorer = {
  toolCallId: 'tc-1',
  result: {
    subagentId: 'sub-1',
    name: 'explorer',
    summary: 'mapped the repo',
  },
}

describe('buildWakeNudge', () => {
  it('tells the parent to answer from completed results when every background subagent is done', () => {
    const content = buildWakeNudge([explorer], [])

    expect(content).toContain('Background subagent results are ready')
    expect(content).toContain('Do not say the subagents are still running')
    expect(content).toContain('explorer: mapped the repo')
    expect(content).not.toContain('still running:')
    expect(content).toContain(
      'Their completed summaries are in the spawn_subagent tool results above.',
    )
    expect(content).toContain(visibleStatus('finished'))
  })

  it('inlines summaries when there is no spawn_subagent tool result to patch', () => {
    const content = buildWakeNudge([explorer], [], { summariesInline: true })

    expect(content).toContain('Their completed summaries are included below.')
    expect(content).not.toContain('spawn_subagent tool results above')
    expect(content).toContain('explorer: mapped the repo')
  })

  it('names still-running subagents and lets the parent answer or wait', () => {
    const content = buildWakeNudge([explorer], ['writer', 'reviewer'])

    expect(content).toContain('Other background subagents are still running: writer, reviewer')
    expect(content).toContain(
      'You may answer about the finished result now or wait for the rest. Your call.',
    )
    expect(content).toContain(visibleStatus('finished'))
    expect(content).toContain('explorer: mapped the repo')
  })
})
