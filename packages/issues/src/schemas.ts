import { z } from 'zod'

export const measurementSourceSchema = z.object({
  type: z.enum(['scorecard', 'bill-vote']),
  weight: z.number().min(0).max(1),
  config: z.object({
    orgs: z.array(z.string()).optional(),
    invert: z.boolean().optional(),
    subjects: z.array(z.string()).optional(),
    agree_position: z.enum(['yes', 'no']).optional(),
  }),
})
export const quizQuestionSchema = z.object({
  slug: z.string(),
  prompt: z.string(),
  agree_direction: z.union([z.literal(1), z.literal(-1)]),
  display_order: z.number().int(),
})
export const saveSelectionsSchema = z.array(
  z.object({
    topic_slug: z.string(),
    lens_slug: z.string(),
    display_order: z.number().int(),
    position: z.number().min(0).max(100).nullable(),
    importance: z.union([z.literal(1), z.literal(2)]),
  }),
)
export type SaveSelectionsPayload = z.infer<typeof saveSelectionsSchema>
