import { Client } from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates-committees')

const CHAMBER_MAP: Record<string, 'state_house' | 'state_senate' | 'state_legislature'> = {
  lower:        'state_house',
  upper:        'state_senate',
  legislature:  'state_legislature',
}

function normalizeRole(raw: string): 'chair' | 'vice_chair' | 'member' {
  const r = raw.toLowerCase().trim()
  if (r === 'chair' || r === 'chairperson' || r === 'chairman' || r === 'chairwoman') return 'chair'
  if (r === 'vice chair' || r === 'vice_chair' || r === 'vice-chair'
      || r === 'vice chairperson' || r === 'vice-chairperson') return 'vice_chair'
  return 'member'
}

export interface IngestStateCommitteesOpts {
  cacheDir?: string
  state?: 'CA' | 'NY' | 'FL' | 'TX' | 'MI' | 'NE'
  client?: Client
}

export interface IngestStateCommitteesStats {
  committeesProcessed: number
  membershipsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
}

interface CommitteeEnvelope {
  id: string
  name: string
  jurisdiction: { id: string }
  chamber: string
  session?: string
  memberships: Array<{ person_id: string; name: string; role: string }>
  sources: Array<{ url: string }>
}

function parseStateFromJurisdiction(id: string): string | null {
  const m = id.match(/state:([a-z]{2})/)
  return m ? m[1]!.toUpperCase() : null
}

async function processCommittee(
  client: Client,
  cmt: CommitteeEnvelope,
  stats: IngestStateCommitteesStats,
): Promise<void> {
  const chamber = CHAMBER_MAP[cmt.chamber.toLowerCase()]
  if (!chamber) {
    stats.errors.push(`committee ${cmt.id}: unknown chamber '${cmt.chamber}' — skipped`)
    return
  }
  const state = parseStateFromJurisdiction(cmt.jurisdiction.id)
  if (!state) {
    stats.errors.push(`committee ${cmt.id}: cannot parse state from jurisdiction`)
    return
  }
  const sourceUrl = cmt.sources[0]?.url ?? ''
  const session = cmt.session ?? null

  for (const m of cmt.memberships) {
    if (!m.person_id) {
      stats.errors.push(`committee ${cmt.id}: membership without person_id, skipped`)
      continue
    }
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [m.person_id],
    )
    if (off.rowCount === 0) {
      stats.officialsUnmatched.push(m.person_id)
      continue
    }
    const role = normalizeRole(m.role)
    const officialId = off.rows[0]!.id

    // PG treats NULL as distinct in unique constraints, so we can't rely
    // on `on conflict` when `session` is NULL. Do a manual check-then-
    // upsert: existing row → UPDATE by primary key, otherwise INSERT
    // (which falls through `on conflict do update` for the non-NULL case).
    const existing = await client.query<{ id: string }>(`
      select id from public.state_committee_memberships
      where official_id = $1
        and openstates_committee_id = $2
        and role = $3
        and session is not distinct from $4
      limit 1
    `, [officialId, cmt.id, role, session])

    if (existing.rowCount && existing.rowCount > 0) {
      await client.query(`
        update public.state_committee_memberships
        set committee_name = $2,
            state          = $3,
            chamber        = $4,
            source_url     = $5,
            ingested_at    = now()
        where id = $1
      `, [existing.rows[0]!.id, cmt.name, state, chamber, sourceUrl])
    } else {
      await client.query(`
        insert into public.state_committee_memberships (
          official_id, openstates_committee_id, committee_name,
          state, chamber, session, role, source_url
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (official_id, openstates_committee_id, session, role)
        do update set
          committee_name = excluded.committee_name,
          state          = excluded.state,
          chamber        = excluded.chamber,
          source_url     = excluded.source_url,
          ingested_at    = now()
      `, [
        officialId, cmt.id, cmt.name,
        state, chamber, session, role, sourceUrl,
      ])
    }
    stats.membershipsUpserted += 1
    stats.officialsMatched += 1
  }
}

export async function ingestStateCommittees(
  opts: IngestStateCommitteesOpts = {},
): Promise<IngestStateCommitteesStats> {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const stats: IngestStateCommitteesStats = {
    committeesProcessed: 0,
    membershipsUpserted: 0,
    officialsMatched: 0,
    officialsUnmatched: [],
    errors: [],
  }

  try {
    let entries: string[]
    try {
      entries = await readdir(cacheDir)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return stats
      throw err
    }

    for (const file of entries) {
      if (!file.endsWith('.json')) continue
      if (opts.state && !file.startsWith(`${opts.state}-`)) continue
      const path = join(cacheDir, file)
      const text = await readFile(path, 'utf8')
      let cmt: CommitteeEnvelope
      try {
        cmt = JSON.parse(text)
      } catch (err) {
        stats.errors.push(`${file}: JSON parse error: ${(err as Error).message}`)
        continue
      }
      if (typeof cmt.id !== 'string' || !cmt.id.startsWith('ocd-committee/')) {
        stats.errors.push(`${file}: missing or invalid id`)
        continue
      }
      await processCommittee(client, cmt, stats)
      stats.committeesProcessed += 1
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return stats
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  ingestStateCommittees({})
    .then(stats => {
      console.log('OpenStates committees ingest summary:')
      console.log(`  committees processed:    ${stats.committeesProcessed}`)
      console.log(`  memberships upserted:    ${stats.membershipsUpserted}`)
      console.log(`  officials matched:       ${stats.officialsMatched}`)
      console.log(`  officials unmatched:     ${stats.officialsUnmatched.length}`)
      console.log(`  errors:                  ${stats.errors.length}`)
      for (const e of stats.errors) console.log(`    - ${e}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
