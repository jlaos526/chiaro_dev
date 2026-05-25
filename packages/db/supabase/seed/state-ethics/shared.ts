import type { Client } from 'pg'

export type EthicsComponent = 'disclosures' | 'complaints' | 'events'

export interface NormalizedFinancialDisclosure {
  official_openstates_person_id: string
  filing_year: number
  filing_date?: string
  income_source?: string
  income_kind?: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
  state: string
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedEthicsComplaint {
  official_openstates_person_id: string
  complaint_date: string
  status: 'open' | 'dismissed' | 'settled' | 'sanctioned' | 'closed_no_action'
  disposition?: string
  summary: string
  state: string
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedOfficialEvent {
  official_openstates_person_id: string
  event_date: string
  event_type: 'recall_attempt' | 'recall_succeeded' | 'recall_failed'
    | 'resignation' | 'censure' | 'expulsion' | 'campaign_finance_violation'
  outcome?: string
  summary: string
  state: string
  source_url: string
  source: string
  external_id?: string
}

export type StateEthicsEvent =
  | NormalizedFinancialDisclosure
  | NormalizedEthicsComplaint
  | NormalizedOfficialEvent

export interface StateEthicsAdapter<E extends StateEthicsEvent = StateEthicsEvent> {
  slug: string
  component: EthicsComponent
  covered_states: string[]
  fetchEvents(opts: {
    client: Client
    state?: string
    fetcher?: () => Promise<E[]>
  }): Promise<E[]>
}

export interface StateEthicsStats {
  component: EthicsComponent
  adapter_slug: string
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

async function resolveOfficial(
  client: Client, openstates_person_id: string,
): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [openstates_person_id],
  )
  return r.rowCount === 0 ? null : r.rows[0]!.id
}

export async function upsertFinancialDisclosure(
  client: Client, d: NormalizedFinancialDisclosure,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, d.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_financial_disclosures (
      official_id, filing_year, filing_date, income_source, income_kind,
      amount_range_low, amount_range_high,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    on conflict (source, external_id) where external_id is not null
    do update set
      filing_year      = excluded.filing_year,
      filing_date      = excluded.filing_date,
      income_source    = excluded.income_source,
      income_kind      = excluded.income_kind,
      amount_range_low = excluded.amount_range_low,
      amount_range_high= excluded.amount_range_high,
      source_url       = excluded.source_url,
      ingested_at      = now()
  `, [
    officialId, d.filing_year, d.filing_date ?? null,
    d.income_source ?? null, d.income_kind ?? null,
    d.amount_range_low ?? null, d.amount_range_high ?? null,
    d.state, d.source_url, d.source, d.external_id ?? null,
  ])
  return true
}

export async function upsertEthicsComplaint(
  client: Client, c: NormalizedEthicsComplaint,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, c.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_ethics_complaints (
      official_id, complaint_date, status, disposition, summary,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict (source, external_id) where external_id is not null
    do update set
      status      = excluded.status,
      disposition = excluded.disposition,
      summary     = excluded.summary,
      source_url  = excluded.source_url,
      ingested_at = now()
  `, [
    officialId, c.complaint_date, c.status,
    c.disposition ?? null, c.summary,
    c.state, c.source_url, c.source, c.external_id ?? null,
  ])
  return true
}

export async function upsertOfficialEvent(
  client: Client, e: NormalizedOfficialEvent,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, e.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_official_events (
      official_id, event_date, event_type, outcome, summary,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict (source, external_id) where external_id is not null
    do update set
      event_type  = excluded.event_type,
      outcome     = excluded.outcome,
      summary     = excluded.summary,
      source_url  = excluded.source_url,
      ingested_at = now()
  `, [
    officialId, e.event_date, e.event_type,
    e.outcome ?? null, e.summary,
    e.state, e.source_url, e.source, e.external_id ?? null,
  ])
  return true
}
