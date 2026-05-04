import { z } from 'zod'

export const profileFormSchema = z.object({
  display_name: z.string().trim().min(1).max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
})

export type ProfileFormInput = z.infer<typeof profileFormSchema>
