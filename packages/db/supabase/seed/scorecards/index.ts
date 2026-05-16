#!/usr/bin/env tsx
// Scorecards orchestrator. Adapters are isolated: a single adapter failure
// is logged in the per-adapter `stats` entry but does not abort the run.
// Task 20 ships 5 progressive/centrist adapters; Task 21 will append 5 more.
import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { lcv } from './lcv.ts'
import { sierraClub } from './sierra-club.ts'
import { aclu } from './aclu.ts'
import { naacp } from './naacp.ts'
import { plannedParenthood } from './planned-parenthood.ts'
import type { ScorecardAdapter } from './shared.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export const ADAPTERS: ScorecardAdapter[] = [
  lcv, sierraClub, aclu, naacp, plannedParenthood,
]

export async function ingestScorecards(opts?: { congress?: string; fixturesDir?: string }): Promise<Record<string, { ratings: number; error?: string }>> {
  const congress = opts?.congress ?? '119'
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  const stats: Record<string, { ratings: number; error?: string }> = {}

  try {
    for (const a of ADAPTERS) {
      await client.query(`
        insert into public.scorecard_orgs
          (slug, name, issue_area, lean, methodology_url, scoring_min, scoring_max, notes)
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (slug) do update set
          name=excluded.name, issue_area=excluded.issue_area, lean=excluded.lean,
          methodology_url=excluded.methodology_url, scoring_min=excluded.scoring_min,
          scoring_max=excluded.scoring_max, notes=excluded.notes
      `, [a.slug, a.name, a.issue_area, a.lean, a.methodology_url, a.scoring_min, a.scoring_max, a.notes ?? null])
    }

    const offRes = await client.query<{ id: string; bioguide_id: string }>(
      'select id, bioguide_id from public.officials'
    )
    const officialByBioguide = new Map(offRes.rows.map(r => [r.bioguide_id, r.id]))

    for (const a of ADAPTERS) {
      try {
        const fixturePath = opts?.fixturesDir
          ? `${opts.fixturesDir}/${a.slug}-${congress}.csv`
          : undefined
        const ratings = await a.fetchRatings(congress, { fixturePath })
        const orgRes = await client.query<{ id: string }>(
          'select id from public.scorecard_orgs where slug = $1', [a.slug])
        const scorecardId = orgRes.rows[0].id

        let count = 0
        for (const r of ratings) {
          const officialId = officialByBioguide.get(r.bioguideId)
          if (!officialId) continue
          await client.query(`
            insert into public.scorecard_ratings
              (scorecard_id, official_id, congress, score, source_url)
            values ($1,$2,$3,$4,$5)
            on conflict (scorecard_id, official_id, congress) do update set
              score = excluded.score, source_url = excluded.source_url
          `, [scorecardId, officialId, congress, r.score, r.source_url])
          count++
        }
        stats[a.slug] = { ratings: count }
      } catch (err) {
        stats[a.slug] = { ratings: 0, error: err instanceof Error ? err.message : String(err) }
        console.error(`[${a.slug}] ingest failed:`, err)
      }
    }
  } finally {
    await client.end().catch(() => {})
  }

  return stats
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ingestScorecards({ fixturesDir: 'packages/db/supabase/seed/fixtures/scorecards' })
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
