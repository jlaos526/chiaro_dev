import { z } from 'zod'

// OpenStates v3 bill envelope (subset of fields we actually use).
// Validates the API JSON payload before upserting.
export const OpenStatesBillSchema = z.object({
  id: z.string().startsWith('ocd-bill/'),
  jurisdiction: z.object({ id: z.string(), classification: z.string() }),
  session: z.string(),
  identifier: z.string(), // e.g., 'AB 123'
  title: z.string(),
  classification: z.array(z.string()).optional(),
  subject: z.array(z.string()).optional(),
  sponsorships: z
    .array(
      z.object({
        person_id: z.string().nullable(),
        name: z.string(),
        classification: z.enum(['primary', 'cosponsor']),
      }),
    )
    .optional(),
  actions: z
    .array(
      z.object({
        description: z.string(),
        date: z.string(),
        classification: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  sources: z.array(z.object({ url: z.string() })),
  openstates_url: z.string().url(),
})

export type OpenStatesBill = z.infer<typeof OpenStatesBillSchema>

export const OpenStatesVoteEventSchema = z.object({
  id: z.string().startsWith('ocd-vote/'),
  bill_id: z.string().startsWith('ocd-bill/'),
  motion_text: z.string(),
  result: z.string(),
  start_date: z.string(),
  organization: z.object({ classification: z.string() }),
  votes: z.array(
    z.object({
      voter_name: z.string(),
      voter_id: z.string().nullable(),
      option: z.string(),
    }),
  ),
  sources: z.array(z.object({ url: z.string() })),
})

export type OpenStatesVoteEvent = z.infer<typeof OpenStatesVoteEventSchema>
