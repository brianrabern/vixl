import { describe, expect, it } from 'vitest'
import loadPrompt from '@/services/prompts/load-prompt'

describe('load-prompt', () => {
  it('renders base prompt with variable substitution', () => {
    const rendered = loadPrompt('system/base.md', {
      projectName: 'vixl',
      projectRoot: '/tmp/vixl',
    })

    expect(rendered).toContain('Project: vixl (/tmp/vixl)')
    expect(rendered).not.toContain('{{projectName}}')
    expect(rendered).not.toContain('{{projectRoot}}')
    expect(rendered).toContain('Workspace tools run only against this repo.')
    expect(rendered).toContain('ask_user')
    expect(rendered).toContain('Never silently switch.')
  })

  it('renders plan-build handoff with path and title', () => {
    const rendered = loadPrompt('handoffs/plan-build.md', {
      planPath: '.vixl/plans/my-plan.md',
      planTitle: 'My plan',
    })

    expect(rendered).toBe(
      'Execute the plan in `.vixl/plans/my-plan.md` (My plan). Read the plan, work through its todos, and implement the changes.',
    )
  })

  it('renders compact checkpoint with skill and plan-todo guidance', () => {
    const rendered = loadPrompt('system/compact.md', {
      focus: 'parent',
    })

    expect(rendered).toContain('Skills loaded')
    expect(rendered).toContain('Plan+todos')
    expect(rendered).toContain('names already loaded')
    expect(rendered).toContain('path if any')
    expect(rendered).toContain('todos done/in progress/pending')
    expect(rendered).toContain('parent')
    expect(rendered).not.toContain('{{focus}}')
  })

  it('renders plan-orchestrate handoff with locked subagent model', () => {
    const rendered = loadPrompt('handoffs/plan-orchestrate.md', {
      planPath: '.vixl/plans/my-plan.md',
      planTitle: 'My plan',
      subagentModel: 'anthropic::claude-sonnet-4',
    })

    expect(rendered).toContain(
      'Orchestrate execution of the plan in `.vixl/plans/my-plan.md` (My plan).',
    )
    expect(rendered).toContain(
      'Subagent model lock: anthropic::claude-sonnet-4. Do not pass `model` to spawn_subagent; the harness uses the locked model.',
    )
    expect(rendered).toContain(
      'After spawning, leave a one-line visible status covering what was spawned, what is still running, and what happens next.',
    )
    expect(rendered).toContain('Do not poll with `terminal_output`.')
    expect(rendered).toContain(
      'End the turn; the harness resumes as each background subagent finishes.',
    )
    expect(rendered).not.toContain('{{subagentModel}}')
  })
})
