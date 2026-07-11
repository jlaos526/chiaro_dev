import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichTexas } from './enrich-tx.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'tx-capitol-HB1.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-tx-HB1', 'TX', '89R', 'HB', 1, 'Test TX HB 1', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query(
    "delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-tx-%'",
  )
  await client.end()
})

describe('enrichTexas', () => {
  it('updates augment from capitol fixture (sparse: only status + date)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichTexas.enrich({
      client,
      session: '89R',
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
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-tx-HB1'
    `)
    expect(row.rows[0]!.status_substage).toBe('Received from the Senate')
    expect(row.rows[0]!.hearing_date).toBe('2025-04-22')
    expect(row.rows[0]!.fiscal_impact_amount).toBeNull()
    expect(row.rows[0]!.augmented_from).toBe('tx-capitol')
  })

  it('null response → no update', async () => {
    const stats = await enrichTexas.enrich({
      client,
      session: '89R',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichTexas.enrich({ client, session: '89R', fetcher } as never)
    const stats2 = await enrichTexas.enrich({ client, session: '89R', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state TX', async () => {
    const stats = await enrichTexas.enrich({
      client,
      session: '89R',
      fetcher: async () => null,
    } as never)
    expect(stats.state).toBe('TX')
  })

  it('handles bills with no fiscal note', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    fixture.bill.fiscalNote = null
    const stats = await enrichTexas.enrich({
      client,
      session: '89R',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    expect(stats.errors).toEqual([])
  })
})
