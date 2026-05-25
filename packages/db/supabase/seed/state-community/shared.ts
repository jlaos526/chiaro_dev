import type { Client } from 'pg'
import type { SkipReason } from '../shared/instrumentation.ts'

export type CommunityComponent = 'halls' | 'offices' | 'hearings'

export interface NormalizedTownHall {
  official_openstates_person_id?: string
  legislator_name?: string
  event_date: string
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  attendance_estimate?: number
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedDistrictOffice {
  official_openstates_person_id: string
  kind: 'district' | 'satellite' | 'capitol'
  street_1: string
  street_2?: string
  city: string
  state: string
  postal_code?: string
  phone?: string
  email?: string
  hours_text?: string
  source_url: string
}

export interface NormalizedCommitteeHearing {
  openstates_committee_id?: string
  state: string
  session: string
  hearing_date: string
  location?: string
  agenda_topic?: string
  source_url: string
  attendees_openstates_person_ids: string[]
}

export type StateCommunityEvent =
  | NormalizedTownHall
  | NormalizedDistrictOffice
  | NormalizedCommitteeHearing

export interface StateCommunityAdapter<E extends StateCommunityEvent = StateCommunityEvent> {
  slug: string
  component: CommunityComponent
  covered_states: string[]
  fetchEvents(opts: {
    client: Client
    state?: string
    session?: string
    fetcher?: () => Promise<E[]>
    /**
     * Optional skip-reason collector (slice 22). When passed, the
     * adapter calls onSkip() at each silent-continue site with a
     * SkipReason record. Used by orchestrator --instrument runs.
     */
    onSkip?: (reason: SkipReason) => void
  }): Promise<E[]>
}

export interface StateCommunityStats {
  component: CommunityComponent
  adapter_slug: string
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * UPSERT a town hall row. Returns true if rated row was written, false
 * if the official is unknown (caller appends to officialsUnmatched).
 * Dedup via (source, external_id) UNIQUE; when external_id is null,
 * inserts always create a new row (NULLs distinct per Postgres default).
 */
export async function upsertTownHall(
  client: Client,
  th: NormalizedTownHall,
): Promise<boolean> {
  if (!th.official_openstates_person_id) {
    return false
  }
  const off = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [th.official_openstates_person_id],
  )
  if (off.rowCount === 0) return false

  await client.query(`
    insert into public.state_town_halls (
      official_id, event_date, city, state, format,
      attendance_estimate, source_url, source, external_id
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (source, external_id) where external_id is not null
    do update set
      event_date          = excluded.event_date,
      city                = excluded.city,
      format              = excluded.format,
      attendance_estimate = excluded.attendance_estimate,
      source_url          = excluded.source_url,
      ingested_at         = now()
  `, [
    off.rows[0]!.id, th.event_date, th.city ?? null, th.state, th.format ?? null,
    th.attendance_estimate ?? null, th.source_url, th.source, th.external_id ?? null,
  ])
  return true
}

/**
 * UPSERT a district office row. Returns true on success, false when
 * the official is unknown.
 * No natural dedup key (offices rarely change ids across scrapes);
 * caller is responsible for clearing/recomputing per re-ingest run.
 */
export async function upsertDistrictOffice(
  client: Client,
  off: NormalizedDistrictOffice,
): Promise<boolean> {
  const o = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [off.official_openstates_person_id],
  )
  if (o.rowCount === 0) return false

  await client.query(`
    insert into public.state_district_offices (
      official_id, kind, street_1, street_2, city, state,
      postal_code, phone, email, hours_text, source_url
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    o.rows[0]!.id, off.kind, off.street_1, off.street_2 ?? null,
    off.city, off.state, off.postal_code ?? null, off.phone ?? null,
    off.email ?? null, off.hours_text ?? null, off.source_url,
  ])
  return true
}

/**
 * UPSERT a committee hearing + attendance rows in a single transaction.
 * Returns number of successfully-matched attendee officials (unmatched
 * appended to stats by caller).
 */
export async function upsertCommitteeHearing(
  client: Client,
  h: NormalizedCommitteeHearing,
): Promise<{ matched: number; unmatched: string[] }> {
  // Try to dedupe by (openstates_committee_id, hearing_date) when committee id present.
  let hearingId: string
  if (h.openstates_committee_id) {
    const existing = await client.query<{ id: string }>(
      `select id from public.state_committee_hearings
        where openstates_committee_id = $1 and hearing_date = $2`,
      [h.openstates_committee_id, h.hearing_date],
    )
    if ((existing.rowCount ?? 0) > 0) {
      hearingId = existing.rows[0]!.id
    } else {
      const ins = await client.query<{ id: string }>(`
        insert into public.state_committee_hearings (
          openstates_committee_id, state, session, hearing_date,
          location, agenda_topic, source_url
        ) values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `, [h.openstates_committee_id, h.state, h.session, h.hearing_date,
          h.location ?? null, h.agenda_topic ?? null, h.source_url])
      hearingId = ins.rows[0]!.id
    }
  } else {
    const ins = await client.query<{ id: string }>(`
      insert into public.state_committee_hearings (
        openstates_committee_id, state, session, hearing_date,
        location, agenda_topic, source_url
      ) values (null, $1, $2, $3, $4, $5, $6)
      returning id
    `, [h.state, h.session, h.hearing_date,
        h.location ?? null, h.agenda_topic ?? null, h.source_url])
    hearingId = ins.rows[0]!.id
  }

  let matched = 0
  const unmatched: string[] = []
  for (const personId of h.attendees_openstates_person_ids) {
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [personId],
    )
    if (off.rowCount === 0) {
      unmatched.push(personId)
      continue
    }
    await client.query(`
      insert into public.state_committee_hearing_attendance (hearing_id, official_id)
      values ($1, $2)
      on conflict (hearing_id, official_id) do nothing
    `, [hearingId, off.rows[0]!.id])
    matched += 1
  }
  return { matched, unmatched }
}
