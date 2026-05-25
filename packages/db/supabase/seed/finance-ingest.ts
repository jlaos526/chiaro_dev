#!/usr/bin/env tsx
// Slice 4+5: iterate officials with opensecrets_id set, fetch snapshot from OpenSecrets,
// upsert finance_summaries + replace finance_industry_top + finance_pac_contributions +
// finance_individual_donors + finance_top_organizations.
// Idempotent: re-running is safe (per-summary delete-then-insert for all children).

import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { fetchFinanceSnapshot, type FinanceSnapshot } from './opensecrets-adapter.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface FinanceIngestArgs {
  apiKey:    string
  cycle?:    string
  snapshotFetcher?: typeof fetchFinanceSnapshot
  fixturesDir?: string
}

export interface FinanceIngestStats {
  officialsProcessed:        number
  summariesUpserted:         number
  industriesUpserted:        number
  pacsUpserted:              number
  individualDonorsUpserted:  number
  topOrganizationsUpserted:  number
  errors:                    Array<{ official_id: string; cid: string; message: string }>
}

export async function ingestFinance(args: FinanceIngestArgs): Promise<FinanceIngestStats> {
  const cycle = args.cycle ?? '2024'
  const fetcher = args.snapshotFetcher ?? fetchFinanceSnapshot
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  const stats: FinanceIngestStats = {
    officialsProcessed: 0,
    summariesUpserted: 0,
    industriesUpserted: 0,
    pacsUpserted: 0,
    individualDonorsUpserted: 0,
    topOrganizationsUpserted: 0,
    errors: [],
  }

  try {
    const officials = await client.query<{ id: string; opensecrets_id: string }>(
      `select id, opensecrets_id from public.officials where opensecrets_id is not null`
    )

    for (const o of officials.rows) {
      stats.officialsProcessed++
      try {
        const fixturePath = args.fixturesDir
          ? `${args.fixturesDir}/opensecrets-summary-${o.opensecrets_id}.json`
          : undefined
        const snap: FinanceSnapshot = await fetcher(o.opensecrets_id, cycle, args.apiKey, fixturePath !== undefined ? { fixturePath } : {})

        await client.query('BEGIN')

        const ins = await client.query<{ id: string }>(`
          insert into public.finance_summaries
            (official_id, cycle, opensecrets_id, total_raised, total_disbursed,
             small_donor_pct, in_state_pct, out_of_state_pct, source_url)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict (official_id, cycle) do update set
            opensecrets_id   = excluded.opensecrets_id,
            total_raised     = excluded.total_raised,
            total_disbursed  = excluded.total_disbursed,
            small_donor_pct  = excluded.small_donor_pct,
            in_state_pct     = excluded.in_state_pct,
            out_of_state_pct = excluded.out_of_state_pct,
            source_url       = excluded.source_url,
            ingested_at      = now()
          returning id
        `, [o.id, cycle, o.opensecrets_id, snap.total_raised, snap.total_disbursed,
            snap.small_donor_pct, snap.in_state_pct, snap.out_of_state_pct, snap.source_url])
        const summaryId = ins.rows[0]!.id
        stats.summariesUpserted++

        await client.query('delete from public.finance_industry_top where finance_summary_id = $1', [summaryId])
        for (const ind of snap.industries) {
          await client.query(`
            insert into public.finance_industry_top
              (finance_summary_id, rank, industry, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, ind.rank, ind.industry, ind.amount])
          stats.industriesUpserted++
        }

        await client.query('delete from public.finance_pac_contributions where finance_summary_id = $1', [summaryId])
        for (const pac of snap.pacs) {
          await client.query(`
            insert into public.finance_pac_contributions
              (finance_summary_id, pac_name, pac_fec_id, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, pac.pac_name, pac.pac_fec_id, pac.amount])
          stats.pacsUpserted++
        }

        await client.query('delete from public.finance_individual_donors where finance_summary_id = $1', [summaryId])
        for (const d of snap.individual_donors) {
          await client.query(`
            insert into public.finance_individual_donors
              (finance_summary_id, rank, donor_name, amount, employer, occupation)
            values ($1,$2,$3,$4,$5,$6)
          `, [summaryId, d.rank, d.donor_name, d.amount, d.employer, d.occupation])
          stats.individualDonorsUpserted++
        }

        await client.query('delete from public.finance_top_organizations where finance_summary_id = $1', [summaryId])
        for (const org of snap.top_organizations) {
          await client.query(`
            insert into public.finance_top_organizations
              (finance_summary_id, rank, org_name, amount)
            values ($1,$2,$3,$4)
          `, [summaryId, org.rank, org.org_name, org.amount])
          stats.topOrganizationsUpserted++
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        stats.errors.push({
          official_id: o.id,
          cid: o.opensecrets_id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    await client.end().catch(() => {})
  }

  return stats
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const apiKey = process.env.OPENSECRETS_API_KEY
  if (!apiKey) { console.error('OPENSECRETS_API_KEY required'); process.exit(1) }
  ingestFinance({ apiKey })
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
