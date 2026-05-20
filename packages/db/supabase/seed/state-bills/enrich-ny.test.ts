import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichNewYork } from './enrich-ny.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'ny-senate-S5678.json')

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
      ('ocd-bill/test-ny-S5678', 'NY', '2025', 'S', 5678, 'Test NY S 5678', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-ny-%'")
  await client.end()
})

describe('enrichNewYork', () => {
  it('updates augment from senate API fixture', async () => {
    process.env.NY_SENATE_API_KEY = 'test-key'
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichNewYork.enrich({
      client, session: '2025',
      fetcher: async () => fixture,
    } as never)
    expect(stats.state).toBe('NY')
    expect(stats.errors).toEqual([])
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      party_vote_split: object | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, party_vote_split, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-ny-S5678'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Finance Committee')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(5400000)
    expect(row.rows[0]!.party_vote_split).toMatchObject({ AYE: 30, NAY: 12, EXC: 1 })
    expect(row.rows[0]!.augmented_from).toBe('ny-senate-api')
  })

  it('missing NY_SENATE_API_KEY → skipped with reason', async () => {
    delete process.env.NY_SENATE_API_KEY
    const stats = await enrichNewYork.enrich({
      client, session: '2025', fetcher: async () => null,
    } as never)
    expect(stats.skipped).toBe(true)
    expect(stats.skipReason).toMatch(/NY_SENATE_API_KEY/)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    process.env.NY_SENATE_API_KEY = 'test-key'
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichNewYork.enrich({ client, session: '2025', fetcher } as never)
    const stats2 = await enrichNewYork.enrich({ client, session: '2025', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })
})
