import type { Client } from 'pg'
import type { Chamber } from '../../shared/officials.ts'

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'

export const RATE_LIMIT_MS = 1000

export function normalizePartyChar(char: string): string {
  switch (char.trim().toUpperCase()) {
    case 'D': return 'Democratic'
    case 'R': return 'Republican'
    case 'I': return 'Independent'
    default: return char
  }
}

/**
 * Resolve full_name + state + chamber → openstates_person_id.
 *
 * Keys ratings off openstates_person_id (not officials.id) per slice 5G
 * orchestrator convention. Returns null on no match OR if matched row has
 * NULL openstates_person_id (e.g. federal officials).
 *
 * Same shape as the module-local helper in nra.ts (slice 9). Hoisted here
 * because mi.ts + co.ts both need it.
 */
export async function resolveOpenstatesPersonId(
  client: Pick<Client, 'query'>,
  opts: { full_name: string; state: string; chamber: Chamber },
): Promise<string | null> {
  const res = await client.query<{ openstates_person_id: string | null }>(
    `select openstates_person_id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  const row = res.rows[0]
  if (!row || !row.openstates_person_id) return null
  return row.openstates_person_id
}
