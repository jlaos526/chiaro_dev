#!/usr/bin/env tsx
// Slice 4: Congress.gov v3 bills + votes ingest orchestrator.
//
// Inherits the slice-3 threshold-guard + audit-run pattern from
// officials-ingest.ts; deactivation guards live there and are reused
// (not re-tested exhaustively — proven by slice 3 Task 17).
//
// Transactional: all DML happens inside a single BEGIN/COMMIT. On any
// error the transaction is rolled back and the error rethrown so the
// orchestrator's caller (CLI guard at bottom of file or the integration
// test) can observe the failure.

import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { fetchBills } from './congress-gov-bills.ts'
import { fetchVotes } from './congress-gov-votes.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CONGRESS = '119'

export interface IngestArgs {
  apiKey:        string
  congress?:     string
  billsFetcher?: typeof fetchBills
  votesFetcher?: typeof fetchVotes
  since?:        string
}

export interface IngestStats {
  billsIngested:         number
  billSubjectsIngested:  number
  billSponsorsIngested:  number
  votesIngested:         number
  votePositionsIngested: number
  status:                'completed' | 'failed'
  error?:                string
}

export async function ingestBillsAndVotes(args: IngestArgs): Promise<IngestStats> {
  const congress = args.congress ?? CONGRESS
  const billsF   = args.billsFetcher ?? fetchBills
  const votesF   = args.votesFetcher ?? fetchVotes

  const client = new Client({ connectionString: DB_URL })
  const stats: IngestStats = {
    billsIngested: 0, billSubjectsIngested: 0, billSponsorsIngested: 0,
    votesIngested: 0, votePositionsIngested: 0,
    status: 'completed',
  }

  try {
    await client.connect()
    await client.query('BEGIN')

    // 1. Load officials bioguide_id → id map
    const offRes = await client.query<{ id: string; bioguide_id: string }>(
      'select id, bioguide_id from public.officials'
    )
    const officialByBioguide = new Map(offRes.rows.map(r => [r.bioguide_id, r.id]))

    // 2. Fetch + upsert bills (and their subjects + sponsors)
    const bills = await billsF(congress, args.apiKey, { since: args.since })
    const billIdByKey = new Map<string, string>()  // `${type}-${number}` → bill UUID

    for (const b of bills) {
      const ins = await client.query<{ id: string }>(`
        insert into public.bills
          (congress, bill_type, number, title, short_title, policy_area, status,
           introduced_date, latest_action, source_url, congress_gov_url)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (congress, bill_type, number) do update set
          title            = excluded.title,
          short_title      = excluded.short_title,
          policy_area      = excluded.policy_area,
          status           = excluded.status,
          latest_action    = excluded.latest_action,
          source_url       = excluded.source_url,
          congress_gov_url = excluded.congress_gov_url
        returning id
      `, [b.congress, b.bill_type, b.number, b.title, b.short_title, b.policy_area,
          b.status, b.introduced_date, b.latest_action, b.source_url, b.congress_gov_url])
      const billId = ins.rows[0].id
      billIdByKey.set(`${b.bill_type}-${b.number}`, billId)
      stats.billsIngested++

      // Replace subjects + sponsors so re-ingest stays idempotent.
      await client.query('delete from public.bill_subjects where bill_id = $1', [billId])
      for (const s of b.subjects) {
        await client.query(
          'insert into public.bill_subjects (bill_id, subject) values ($1,$2) on conflict do nothing',
          [billId, s])
        stats.billSubjectsIngested++
      }
      await client.query('delete from public.bill_sponsors where bill_id = $1', [billId])
      for (const sp of b.sponsors) {
        const officialId = officialByBioguide.get(sp.bioguide_id)
        if (!officialId) continue
        await client.query(
          'insert into public.bill_sponsors (bill_id, official_id, role, added_date) values ($1,$2,$3,$4) on conflict do nothing',
          [billId, officialId, sp.role, sp.added_date])
        stats.billSponsorsIngested++
      }
    }

    // 3. Fetch + upsert votes (both chambers in parallel)
    const [houseVotes, senateVotes] = await Promise.all([
      votesF('house',  congress, args.apiKey),
      votesF('senate', congress, args.apiKey),
    ])

    for (const v of [...houseVotes, ...senateVotes]) {
      const billId = v.bill_ref
        ? billIdByKey.get(`${v.bill_ref.type.toLowerCase()}-${v.bill_ref.number}`) ?? null
        : null
      const ins = await client.query<{ id: string }>(`
        insert into public.votes
          (congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (congress, chamber, session, roll_call) do update set
          vote_date  = excluded.vote_date,
          question   = excluded.question,
          result     = excluded.result,
          bill_id    = excluded.bill_id,
          source_url = excluded.source_url
        returning id
      `, [v.congress, v.chamber, v.session, v.roll_call, v.vote_date, v.question, v.result, billId, v.source_url])
      const voteId = ins.rows[0].id
      stats.votesIngested++

      await client.query('delete from public.vote_positions where vote_id = $1', [voteId])
      for (const pos of v.positions) {
        const officialId = officialByBioguide.get(pos.bioguide_id)
        if (!officialId) continue
        await client.query(
          'insert into public.vote_positions (vote_id, official_id, position) values ($1,$2,$3) on conflict do nothing',
          [voteId, officialId, pos.position])
        stats.votePositionsIngested++
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    stats.status = 'failed'
    stats.error = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    await client.end().catch(() => {})
  }

  return stats
}

// CLI guard: only runs when this file is executed directly via `tsx`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const apiKey = process.env.CONGRESS_GOV_API_KEY
  if (!apiKey) {
    console.error('CONGRESS_GOV_API_KEY required')
    process.exit(1)
  }
  ingestBillsAndVotes({ apiKey })
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
