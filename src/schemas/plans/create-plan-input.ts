import { z } from 'zod'
import { planTodoItemSchema } from '@/schemas/plan-document'

export const createPlanInputSchema = z.object({
  title: z.string().min(1).describe('Plan title'),
  body: z.string().describe('Markdown plan body'),
  todos: z
    .array(planTodoItemSchema)
    .optional()
    .describe(
      'Initial todos: one short verb-first line naming a single actionable item; details in the plan body',
    ),
})

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>

export default createPlanInputSchema
