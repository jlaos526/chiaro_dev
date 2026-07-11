import type { Client } from 'pg'

export type Chamber =
  | 'state_house'
  | 'state_senate'
  | 'state_legislature'
  | 'federal_house'
  | 'federal_senate'

/** Info passed to onAmbiguous when a name matches >1 in-office official. */
export interface AmbiguousMatch {
  full_name: string
  state: string
  chamber: Chamber
}

/**
 * Case-insensitive lookup of officials.id by full_name + state + chamber.
 * Used by state-finance/* + state-community/town-halls/mobilize +
 * federal-community/town-halls/mobilize.
 *
 * Moved from state-finance/shared.ts in slice 8. The original signature
 * constrained `state` to FinanceState (5-state union); slice 8 broadens
 * to plain string to support nationwide adapters (mobilize) without
 * type casts.
 *
 * Slice 68 (audit G3): ambiguity guard. Two in-office officials sharing
 * full_name+state+chamber would otherwise attach scraped ethics/finance/
 * recall data to an ARBITRARY one silently — the worst reputational
 * failure mode for a civic app. `limit 2` detects the collision; when it
 * fires the resolver calls `opts.onAmbiguous?.(...)` and returns null so
 * no attribution happens. Callers with an onSkip in scope route this to
 * a `resolve_ambiguous` skip; callers without one just get the safe null.
 */
export async function resolveOfficialByName(
  client: Client,
  opts: {
    full_name: string
    state: string
    chamber: Chamber
    onAmbiguous?: (info: AmbiguousMatch) => void
  },
): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    `select id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 2`,
    [opts.full_name, opts.state, opts.chamber],
  )
  if (res.rows.length > 1) {
    opts.onAmbiguous?.({ full_name: opts.full_name, state: opts.state, chamber: opts.chamber })
    return null
  }
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
 *
 * Slice 68 (audit G3): same ambiguity guard as resolveOfficialByName —
 * `limit 2`, `opts.onAmbiguous?.(...)` + null on a >1 in-office match.
 */
export async function resolveOpenstatesPersonId(
  client: Pick<Client, 'query'>,
  opts: {
    full_name: string
    state: string
    chamber: Chamber
    onAmbiguous?: (info: AmbiguousMatch) => void
  },
): Promise<string | null> {
  const res = await client.query<{ openstates_person_id: string | null }>(
    `select openstates_person_id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 2`,
    [opts.full_name, opts.state, opts.chamber],
  )
  if (res.rows.length > 1) {
    opts.onAmbiguous?.({ full_name: opts.full_name, state: opts.state, chamber: opts.chamber })
    return null
  }
  const row = res.rows[0]
  if (!row || !row.openstates_person_id) return null
  return row.openstates_person_id
}
