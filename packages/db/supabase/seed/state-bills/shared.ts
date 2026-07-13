import type { Client } from 'pg'
import { fetchWithRetry as sharedFetchWithRetry } from '../shared/http.ts'

export type EnrichableState = 'CA' | 'NY' | 'FL' | 'TX' | 'MI'

export interface StateEnrichAdapter {
  state: EnrichableState
  /** Set true when adapter is skipped (e.g., missing required API key). */
  enrich(opts: { client: Client; session: string }): Promise<EnrichStats>
}

export interface EnrichStats {
  state: EnrichableState
  billsUpdated: number
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * Update augment fields on state_bills for a single bill identified by
 * (state, session, bill_type, number). Returns true if a row was updated,
 * false if no such bill exists yet (caller can log + continue).
 */
export async function updateStateBillAugment(
  client: Client,
  key: { state: string; session: string; bill_type: string; number: number },
  augment: {
    status_substage?: string | null
    hearing_date?: string | null
    fiscal_impact_amount?: number | null
    party_vote_split?: object | null
    augmented_from: string
  },
): Promise<boolean> {
  const result = await client.query(
    `
    update public.state_bills set
      status_substage      = coalesce($5, status_substage),
      hearing_date         = coalesce($6, hearing_date),
      fiscal_impact_amount = coalesce($7, fiscal_impact_amount),
      party_vote_split     = coalesce($8::jsonb, party_vote_split),
      augmented_from       = $9,
      updated_at           = now()
    where state = $1 and session = $2 and bill_type = $3 and number = $4
  `,
    [
      key.state,
      key.session,
      key.bill_type,
      key.number,
      augment.status_substage ?? null,
      augment.hearing_date ?? null,
      augment.fiscal_impact_amount ?? null,
      augment.party_vote_split ? JSON.stringify(augment.party_vote_split) : null,
      augment.augmented_from,
    ],
  )
  return (result.rowCount ?? 0) > 0
}

/**
 * HTTP retry helper. 5x exponential backoff: 500ms, 1s, 2s, 4s, 8s.
 *
 * Since slice 81 (audit C36) a thin wrapper around the canonical
 * `seed/shared/http.ts` fetchWithRetry (same name/signature kept for the
 * 5 enrich-adapter callers). Observable deltas, all safe for those
 * callers (every one maps ANY failure to `null` via `!res.ok` + catch):
 * - non-404 4xx is returned immediately instead of being retried 6× and
 *   then thrown (the old loop retried on any non-ok status);
 * - retries exhausted on 5xx returns the last Response instead of
 *   throwing (`!res.ok` guards still fire);
 * - each attempt now has a 15s timeout (was unbounded — audit C36).
 */
export async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  return sharedFetchWithRetry(url, { retries: 5, backoffMs: 500, ...(init ? { init } : {}) })
}
