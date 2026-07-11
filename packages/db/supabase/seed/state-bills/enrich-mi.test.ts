import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichMichigan } from './enrich-mi.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'mi-legislature-SB2.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-mi-SB2', 'MI', '2025-2026', 'SB', 2, 'Test MI SB 2', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query(
    "delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-mi-%'",
  )
  await client.end()
})

describe('enrichMichigan', () => {
  it('updates augment from fixture', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichMichigan.enrich({
      client,
      session: '2025-2026',
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
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-mi-SB2'
    `)
    expect(row.rows[0]!.status_substage).toBe('Referred to Committee on Government Operations')
    expect(row.rows[0]!.hearing_date).toBe('2025-01-25')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(1200000)
    expect(row.rows[0]!.augmented_from).toBe('mi-legislature')
  })

  it('null response → no update', async () => {
    const stats = await enrichMichigan.enrich({
      client,
      session: '2025-2026',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichMichigan.enrich({ client, session: '2025-2026', fetcher } as never)
    const stats2 = await enrichMichigan.enrich({ client, session: '2025-2026', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state MI', async () => {
    const stats = await enrichMichigan.enrich({
      client,
      session: '2025-2026',
      fetcher: async () => null,
    } as never)
    expect(stats.state).toBe('MI')
  })

  it('handles missing FiscalImpact', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    delete fixture.FiscalImpact
    const stats = await enrichMichigan.enrich({
      client,
      session: '2025-2026',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    expect(stats.errors).toEqual([])
  })
})
