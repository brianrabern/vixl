import { beforeEach, describe, expect, it, vi } from 'vitest'
import createPlan from '@/services/plans/write-plan'
import parsePlan from '@/services/plans/parse-plan'
import {
  dropPlanExecutionSession,
  setActivePlanPath,
} from '@/services/harness/plan-execution-session'
import type { PendingApprovalView } from '@/services/harness/permission/gate'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const fsWriteFile = vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({})
const fsReadFile = vi.fn<(...args: unknown[]) => Promise<{ content: string }>>()
const openPlan = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
const ensureHomeRoot = vi.fn<() => Promise<string>>().mockResolvedValue('/Users/test-home')
const resolveProjectIdByRoot = vi.fn<(root: string) => string | null>(() => 'project-1')
const refreshPlanTabs = vi.fn<() => void>()

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    fsWriteFile,
    fsReadFile,
  }),
)

vi.mock('@/composables/use-workbench-store', () => ({
  default: () => ({
    openPlan,
    ensureHomeRoot,
    resolveProjectIdByRoot,
    refreshPlanTabs,
  }),
}))

const projectSlug = 'project'
const chatId = 'chat-update-plan-todo'
const projectRoot = '/tmp/project'

const planCtx = (): HarnessToolContext => ({
  projectRoot,
  projectSlug,
  chatId,
  mode: 'agent',
  settings: { version: 1 } as VixlSettings,
  permissionLevel: 'ask',
  sessionAllows: new Set<string>(),
  sessionDenies: new Set<string>(),
  sandboxEnabled: false,
  supportsVision: false,
  onPendingApproval: vi.fn<(entry: PendingApprovalView) => void>(),
})

const runTool = async (
  execute: unknown,
  input: Record<string, unknown>,
): Promise<unknown> => {
  const runner = execute as (
    value: Record<string, unknown>,
    options: { toolCallId: string },
  ) => Promise<unknown>
  return runner(input, { toolCallId: 'tc-update-plan-todo' })
}

const existingPlan = createPlan({
  title: 'Merge plan',
  body: '## Goal\n\nShip it.\n',
  todos: [
    { id: 'keep', content: 'Keep me', status: 'in_progress' },
    { id: 'update', content: 'Old text', status: 'pending' },
  ],
})

describe('update_plan_todo', () => {
  beforeEach(() => {
    dropPlanExecutionSession(projectSlug, chatId)
    openPlan.mockClear()
    ensureHomeRoot.mockClear()
    resolveProjectIdByRoot.mockClear()
    refreshPlanTabs.mockClear()
    fsWriteFile.mockClear()
    fsReadFile.mockReset()
    fsReadFile.mockResolvedValue({ content: existingPlan.content })
  })

  it('merges by id: updates matches, appends new ids, and keeps unmentioned todos', async () => {
    const updatePlanTodo = (await import('@/services/harness/plan/update-todo')).default
    const tool = updatePlanTodo(planCtx())

    const result = (await runTool(tool.execute, {
      planPath: existingPlan.path,
      todos: [
        { id: 'update', content: 'New text', status: 'completed' },
        { id: 'append', content: 'New todo', status: 'pending' },
      ],
    })) as { planPath: string; todos: Array<{ id: string; content: string; status: string }> }

    const merged = [
      { id: 'keep', content: 'Keep me', status: 'in_progress' },
      { id: 'update', content: 'New text', status: 'completed' },
      { id: 'append', content: 'New todo', status: 'pending' },
    ]
    expect(result).toEqual({ planPath: existingPlan.path, todos: merged })
    expect(fsWriteFile).toHaveBeenCalledTimes(1)
    const written = fsWriteFile.mock.calls[0]?.[0] as {
      projectRoot: string
      path: string
      content: string
    }
    expect(written.projectRoot).toBe(projectRoot)
    expect(written.path).toBe(existingPlan.path)
    const parsed = parsePlan(written.content)
    expect(parsed.parseError).toBeUndefined()
    expect(parsed.frontmatter?.todos).toEqual(merged)
  })

  it('resolves via session.activePlanPath when planPath and awaitingPlanGo are absent', async () => {
    setActivePlanPath(projectSlug, chatId, existingPlan.path)
    const updatePlanTodo = (await import('@/services/harness/plan/update-todo')).default
    const tool = updatePlanTodo(planCtx())

    const result = (await runTool(tool.execute, {
      todos: [{ id: 'update', content: 'New text', status: 'completed' }],
    })) as { planPath: string; todos: Array<{ id: string }> }

    expect(result.planPath).toBe(existingPlan.path)
    expect(result.todos.map((todo) => todo.id)).toEqual(['keep', 'update'])
    expect(fsReadFile).toHaveBeenCalledWith({
      projectRoot,
      path: existingPlan.path,
    })
    expect(fsWriteFile).toHaveBeenCalled()
  })

  it('returns todos unchanged when no plan resolves', async () => {
    const updatePlanTodo = (await import('@/services/harness/plan/update-todo')).default
    const tool = updatePlanTodo(planCtx())
    const todos = [
      { id: 'chat-only', content: 'Track in chat Tasks', status: 'in_progress' },
    ]

    const result = await runTool(tool.execute, { todos })

    expect(result).toEqual({ todos })
    expect(fsReadFile).not.toHaveBeenCalled()
    expect(fsWriteFile).not.toHaveBeenCalled()
  })
})
