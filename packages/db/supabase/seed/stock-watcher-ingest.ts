#!/usr/bin/env tsx
import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface StockDisclosure {
  bioguide_id: string
  transaction_date: string
  filing_date: string
  asset_ticker?: string
  asset_name?: string
  transaction_type: 'purchase' | 'sale' | 'exchange'
  amount_range_low?: number
  amount_range_high?: number
  source_url: string
}

export async function ingestStockDisclosures(opts: {
  houseFetcher?: () => Promise<StockDisclosure[]>
  senateFetcher?: () => Promise<StockDisclosure[]>
}) {
  const house = await (opts.houseFetcher ?? defaultHouse)()
  const senate = await (opts.senateFetcher ?? defaultSenate)()
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  let inserted = 0

  try {
    const off = await client.query<{ id: string; bioguide_id: string }>(
      'select id, bioguide_id from public.officials',
    )
    const map = new Map(off.rows.map((r) => [r.bioguide_id, r.id]))

    await client.query('BEGIN')
    await client.query(
      "delete from public.stock_transactions where transaction_date >= '2025-01-03'",
    )
    for (const d of [...house, ...senate]) {
      const officialId = map.get(d.bioguide_id)
      if (!officialId) continue
      await client.query(
        `
        insert into public.stock_transactions
          (official_id, transaction_date, filing_date, asset_ticker, asset_name,
           transaction_type, amount_range_low, amount_range_high, source_url, source)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'legacy')
      `,
        [
          officialId,
          d.transaction_date,
          d.filing_date,
          d.asset_ticker ?? null,
          d.asset_name ?? null,
          d.transaction_type,
          d.amount_range_low ?? null,
          d.amount_range_high ?? null,
          d.source_url,
        ],
      )
      inserted++
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }
  return { disclosuresIngested: inserted }
}

async function defaultHouse(): Promise<StockDisclosure[]> {
  throw new Error('Use injected fetcher; slice 4 ships fixture mode')
}
async function defaultSenate(): Promise<StockDisclosure[]> {
  throw new Error('Use injected fetcher; slice 4 ships fixture mode')
}

if (isCliEntry(import.meta.url)) {
  ingestStockDisclosures({})
    .then((s) => {
      console.log(JSON.stringify(s, null, 2))
      process.exit(0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(2)
    })
}
