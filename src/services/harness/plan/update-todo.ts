import { tool } from 'ai'
import { z } from 'zod'
import { planTodoItemSchema } from '@/schemas/plan-document'
import parsePlan from '@/services/plans/parse-plan'
import { mergePlanTodos, updatePlanTodos } from '@/services/plans/write-plan'
import { fsReadFile, fsWriteFile } from '@/services/vixl/vixl-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { HOME_WORKSPACE_ID, isHomeChatSlug } from '@/constants/home-chat'
import {
  getPlanExecutionSession,
  resolveUpdatePlanTodoPath,
} from '@/services/harness/plan-execution-session'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const updatePlanTodo = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Update todos in a plan file; omit planPath for the active plan or in-chat Tasks. Todos merge by id: passed todos update matching ids, new ids append, unmentioned todos keep their state. To drop a todo, mark it cancelled.',
    inputSchema: z.object({
      planPath: z
        .string()
        .optional()
        .describe(
          'Path to PLAN.md; omit to use the active plan, or in-chat Tasks if none',
        ),
      todos: z.array(
        z.object({
          id: z.string().describe('Stable todo id'),
          content: z.string().describe('Todo text'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .describe('Todo status'),
        }),
      ),
    }),
    execute: async ({ planPath, todos }) => {
      const session = getPlanExecutionSession(ctx.projectSlug, ctx.chatId)
      const resolvedPlanPath = resolveUpdatePlanTodoPath(
        planPath,
        session.awaitingPlanGo,
        session.activePlanPath,
      )
      if (!resolvedPlanPath) {
        return { todos: z.array(planTodoItemSchema).parse(todos) }
      }
      const existing = await fsReadFile({
        projectRoot: ctx.projectRoot,
        path: resolvedPlanPath,
      })
      const parsed = parsePlan(existing.content)
      if (parsed.parseError) {
        throw new Error(parsed.parseError)
      }
      const merged = mergePlanTodos(parsed.frontmatter?.todos ?? [], todos)
      const nextContent = updatePlanTodos(existing.content, merged)
      await fsWriteFile({
        projectRoot: ctx.projectRoot,
        path: resolvedPlanPath,
        content: nextContent,
      })
      const workbench = useWorkbenchStore()
      let projectId: string | null = null
      if (isHomeChatSlug(ctx.projectSlug)) {
        await workbench.ensureHomeRoot()
        projectId = HOME_WORKSPACE_ID
      } else {
        projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      }
      if (projectId) {
        await workbench.openPlan(
          projectId,
          parsed.frontmatter!.id,
          resolvedPlanPath,
          parsed.frontmatter!.title,
        )
        workbench.refreshPlanTabs()
      }
      return { planPath: resolvedPlanPath, todos: merged }
    },
  })

export default updatePlanTodo
