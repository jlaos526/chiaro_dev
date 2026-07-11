#!/usr/bin/env tsx
import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface TownHallEvent {
  bioguide_id: string
  event_date: string
  city?: string
  state?: string
  format: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  attendance_estimate?: number
  source_url: string
}

export async function ingestTownHalls(opts: { fetcher?: () => Promise<TownHallEvent[]> }) {
  const fetcher = opts.fetcher ?? defaultFetcher
  const events = await fetcher()
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  let inserted = 0

  try {
    const off = await client.query<{ id: string; bioguide_id: string }>(
      'select id, bioguide_id from public.officials',
    )
    const map = new Map(off.rows.map((r) => [r.bioguide_id, r.id]))

    await client.query('BEGIN')
    // Replace town_halls fully for the current Congress window (idempotent)
    await client.query("delete from public.town_halls where event_date >= '2025-01-03'")
    for (const e of events) {
      const officialId = map.get(e.bioguide_id)
      if (!officialId) continue
      await client.query(
        `
        insert into public.town_halls
          (official_id, event_date, city, state, format, attendance_estimate, source_url, source)
        values ($1,$2,$3,$4,$5,$6,$7,'legacy')
      `,
        [
          officialId,
          e.event_date,
          e.city ?? null,
          e.state ?? null,
          e.format,
          e.attendance_estimate ?? null,
          e.source_url,
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

  return { eventsIngested: inserted }
}

async function defaultFetcher(): Promise<TownHallEvent[]> {
  // Town Hall Project publishes an Airtable-backed API. Schema: discover at
  // townhallproject.com/api. For slice 4: implement against their current
  // public endpoint; fixture-based test covers the upsert path.
  throw new Error(
    'Town Hall Project live fetcher not implemented for slice 4; use injected fetcher.',
  )
}

if (isCliEntry(import.meta.url)) {
  ingestTownHalls({})
    .then((s) => {
      console.log(JSON.stringify(s, null, 2))
      process.exit(0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(2)
    })
}
