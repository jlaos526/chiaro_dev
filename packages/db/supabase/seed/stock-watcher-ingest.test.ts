import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestStockDisclosures } from './stock-watcher-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HOUSE_FIX  = join(__dirname, 'fixtures', 'house-stock-watcher-mini.json')
const SENATE_FIX = join(__dirname, 'fixtures', 'senate-stock-watcher-mini.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','CA','CA-11-stkfix','CA-11 stk',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-stk')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-11-stkfix'")
  await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('SKHOUSE1','SK','H','SK H','house','D','CA',$1::uuid,null,'119'),
           ('SKSENATE1','SK','S','SK S','senate','D','CA',$1::uuid,1,'119')
    on conflict (bioguide_id) do nothing
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.stock_transactions where official_id in (select id from public.officials where bioguide_id in ('SKHOUSE1','SKSENATE1'))")
  await client.query("delete from public.officials where bioguide_id in ('SKHOUSE1','SKSENATE1')")
  await client.end()
})

describe('ingestStockDisclosures', () => {
  it('inserts all disclosures and days_late generated column computes correctly', async () => {
    const house  = JSON.parse(await readFile(HOUSE_FIX, 'utf8'))
    const senate = JSON.parse(await readFile(SENATE_FIX, 'utf8'))

    const stats = await ingestStockDisclosures({
      houseFetcher:  async () => house,
      senateFetcher: async () => senate,
    })
    expect(stats.disclosuresIngested).toBe(3)

    // days_late = max(0, filing_date - transaction_date - 45)
    const rows = await client.query(`
      select asset_ticker, days_late
      from public.stock_transactions
      where official_id in (select id from public.officials where bioguide_id in ('SKHOUSE1','SKSENATE1'))
      order by transaction_date
    `)
    expect(rows.rows.length).toBe(3)

    // NVDA: 2026-01-10 -> 2026-01-25 (15 days) -> days_late = 0
    expect(rows.rows.find((r: any) => r.asset_ticker === 'NVDA').days_late).toBe(0)
    // TSLA: 2026-02-01 -> 2026-04-15 (73 days) -> days_late = 28
    expect(rows.rows.find((r: any) => r.asset_ticker === 'TSLA').days_late).toBe(28)
    // AAPL: 2026-01-15 -> 2026-02-28 (44 days) -> days_late = 0
    expect(rows.rows.find((r: any) => r.asset_ticker === 'AAPL').days_late).toBe(0)
  })

  it('idempotent: re-running with same fixtures keeps count at 3', async () => {
    const house  = JSON.parse(await readFile(HOUSE_FIX, 'utf8'))
    const senate = JSON.parse(await readFile(SENATE_FIX, 'utf8'))
    await ingestStockDisclosures({ houseFetcher: async () => house, senateFetcher: async () => senate })
    await ingestStockDisclosures({ houseFetcher: async () => house, senateFetcher: async () => senate })
    const c = await client.query(`select count(*)::int as c from public.stock_transactions where official_id in (select id from public.officials where bioguide_id in ('SKHOUSE1','SKSENATE1'))`)
    expect(c.rows[0].c).toBe(3)
  })
})
