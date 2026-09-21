import { tool } from 'ai'
import { z } from 'zod'
import { planTodoItemSchema } from '@/schemas/plan-document'

const updateTodos = () =>
  tool({
    description:
      'Replace the in-chat todo list; shown in Tasks. One short verb-first line naming a single actionable item.',
    inputSchema: z.object({
      todos: z.array(planTodoItemSchema).describe('Full todo list to show in chat Tasks'),
    }),
    execute: async ({ todos }) => {
      const normalized = z.array(planTodoItemSchema).parse(todos)
      return { todos: normalized }
    },
  })

export default updateTodos
