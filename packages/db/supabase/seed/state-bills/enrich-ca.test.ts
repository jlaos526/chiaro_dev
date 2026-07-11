import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichCalifornia } from './enrich-ca.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'ca-leginfo-AB123.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title,
      source_url, openstates_url
    )
    values
      ('ocd-bill/test-ca-AB123', 'CA', '20252026', 'AB', 123, 'Test CA AB 123', 'https://x', 'https://y'),
      ('ocd-bill/test-ca-SB45',  'CA', '20252026', 'SB', 45,  'Test CA SB 45',  'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query(
    "delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-ca-%'",
  )
  await client.end()
})

describe('enrichCalifornia', () => {
  it('updates augment fields from leginfo fixture', async () => {
    const fixtureText = await readFile(FIXTURE, 'utf8')
    const fixture = JSON.parse(fixtureText)
    const stats = await enrichCalifornia.enrich({
      client,
      session: '20252026',
      fetcher: async (billRef: { bill_type: string; number: number }) =>
        billRef.bill_type === 'AB' && billRef.number === 123 ? fixture : null,
    } as never)
    expect(stats.state).toBe('CA')
    expect(stats.errors).toEqual([])
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      party_vote_split: object | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount,
             party_vote_split, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-ca-AB123'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Committee — Suspense File')
    expect(row.rows[0]!.hearing_date).toBe('2025-04-12')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(2500000)
    expect(row.rows[0]!.party_vote_split).toMatchObject({ 'D-yes': 12 })
    expect(row.rows[0]!.augmented_from).toBe('ca-leginfo')
  })

  it('bill with no fixture response → not updated; stats.billsUpdated unchanged', async () => {
    const stats = await enrichCalifornia.enrich({
      client,
      session: '20252026',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
    const sb = await client.query<{ augmented_from: string | null }>(
      `select augmented_from from public.state_bills where openstates_bill_id = 'ocd-bill/test-ca-SB45'`,
    )
    expect(sb.rows[0]!.augmented_from).toBeNull()
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async (billRef: { bill_type: string; number: number }) =>
      billRef.bill_type === 'AB' && billRef.number === 123 ? fixture : null
    await enrichCalifornia.enrich({ client, session: '20252026', fetcher } as never)
    const stats2 = await enrichCalifornia.enrich({ client, session: '20252026', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state CA + correct skipped=false', async () => {
    const stats = await enrichCalifornia.enrich({
      client,
      session: '20252026',
      fetcher: async () => null,
    } as never)
    expect(stats.state).toBe('CA')
    expect(stats.skipped).toBeUndefined()
  })

  it('non-2025 session: no bills updated', async () => {
    const stats = await enrichCalifornia.enrich({
      client,
      session: '99999999',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })
})
