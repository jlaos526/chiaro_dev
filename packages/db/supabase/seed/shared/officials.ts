import type { Client } from 'pg'

export type Chamber =
  | 'state_house'
  | 'state_senate'
  | 'state_legislature'
  | 'federal_house'
  | 'federal_senate'

/**
 * Case-insensitive lookup of officials.id by full_name + state + chamber.
 * Used by state-finance/* + state-community/town-halls/mobilize +
 * federal-community/town-halls/mobilize.
 *
 * Moved from state-finance/shared.ts in slice 8. The original signature
 * constrained `state` to FinanceState (5-state union); slice 8 broadens
 * to plain string to support nationwide adapters (mobilize) without
 * type casts.
 */
export async function resolveOfficialByName(
  client: Client,
  opts: { full_name: string; state: string; chamber: Chamber },
): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    `select id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  return res.rows[0]?.id ?? null
}

/**
 * Resolve full_name + state + chamber → openstates_person_id.
 *
 * State-tier orchestrators key Normalized* rows off openstates_person_id
 * (not officials.id) per slice 5G/5H/5I convention. The upsert helpers
 * (upsertOfficialEvent, upsertTownHall, upsertEthicsComplaint, etc.)
 * resolve the openstates_person_id to officials.id inside the DB write.
 *
 * Returns null on no match OR if matched row has NULL
 * openstates_person_id (e.g. federal officials).
 *
 * Hoisted from state-scorecards/lcv/helpers.ts in slice 15 — needed by
 * 4 new NY parsers + retained re-export from lcv/helpers.ts for slice 11
 * back-compat.
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
