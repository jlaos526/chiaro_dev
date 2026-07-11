import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichFlorida } from './enrich-fl.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'fl-senate-SB9.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-fl-SB9', 'FL', '2025', 'SB', 9, 'Test FL SB 9', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query(
    "delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-fl-%'",
  )
  await client.end()
})

describe('enrichFlorida', () => {
  it('updates augment from senate fixture', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichFlorida.enrich({
      client,
      session: '2025',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-fl-SB9'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Subcommittee on Education')
    expect(row.rows[0]!.hearing_date).toBe('2025-03-01')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(750000)
    expect(row.rows[0]!.augmented_from).toBe('fl-senate-api')
  })

  it('null fetcher response → not updated', async () => {
    const stats = await enrichFlorida.enrich({
      client,
      session: '2025',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichFlorida.enrich({ client, session: '2025', fetcher } as never)
    const stats2 = await enrichFlorida.enrich({ client, session: '2025', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state FL', async () => {
    const stats = await enrichFlorida.enrich({
      client,
      session: '2025',
      fetcher: async () => null,
    } as never)
    expect(stats.state).toBe('FL')
  })

  it('handles missing FiscalImpactStatement', async () => {
    const fixture = {
      bill: { Session: 2025, Number: 'SB 9', CurrentCommittee: 'X', LastActionDate: '2025-03-01' },
    }
    const stats = await enrichFlorida.enrich({
      client,
      session: '2025',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{ fiscal_impact_amount: string | null }>(
      `select fiscal_impact_amount from public.state_bills where openstates_bill_id = 'ocd-bill/test-fl-SB9'`,
    )
    expect(row.rows[0]!.fiscal_impact_amount).toBeNull()
  })
})
