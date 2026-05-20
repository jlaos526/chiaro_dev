import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { updateStateBillAugment } from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title,
      source_url, openstates_url
    )
    values ('ocd-bill/test-shared', 'CA', '20252026', 'AB', 999, 'Test', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'")
  await client.end()
})

describe('updateStateBillAugment', () => {
  it('updates augment fields on a matching bill', async () => {
    const ok = await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      status_substage: 'Senate Appropriations Committee',
      fiscal_impact_amount: 1_000_000,
      party_vote_split: { 'D-yes': 12, 'D-no': 0 },
      augmented_from: 'ca-leginfo',
    })
    expect(ok).toBe(true)
    const row = await client.query<{
      status_substage: string | null
      fiscal_impact_amount: string | null
      party_vote_split: object | null
      augmented_from: string | null
    }>(`
      select status_substage, fiscal_impact_amount, party_vote_split, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Committee')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(1_000_000)
    expect(row.rows[0]!.party_vote_split).toEqual({ 'D-yes': 12, 'D-no': 0 })
    expect(row.rows[0]!.augmented_from).toBe('ca-leginfo')
  })

  it('returns false when no matching bill', async () => {
    const ok = await updateStateBillAugment(client, {
      state: 'XX', session: '0000', bill_type: 'AB', number: 0,
    }, {
      augmented_from: 'never',
    })
    expect(ok).toBe(false)
  })

  it('preserves existing fields when augment passes null', async () => {
    await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      status_substage: 'Initial',
      augmented_from: 'ca-leginfo',
    })
    await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      fiscal_impact_amount: 50_000,
      augmented_from: 'ca-leginfo',
    })
    const row = await client.query<{ status_substage: string | null }>(
      `select status_substage from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'`,
    )
    expect(row.rows[0]!.status_substage).toBe('Initial')
  })
})
