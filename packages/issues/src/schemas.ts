import { z } from 'zod'

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
