#!/usr/bin/env tsx
// Sub-slice 5C state-officials ingest — OpenStates YAML → public.officials.
//
// Mirrors the defensive shape of officials-ingest.ts (slice 3):
//   - Pre-flight count check on lower / (upper+legislature) before any write.
//   - Per-person district lookup (state-leg-config normalizes the raw
//     district string to TIGER's <STATE>-<code> form); unmatched legislators
//     (NH multi-word, DC, territories, etc.) are logged and skipped, not
//     fatal.
//   - Idempotent upsert keyed on the partial unique index
//     officials_openstates_person_idx (openstates_person_id where not null).
//   - Deactivation sweep with threshold guard mirroring slice 3.
//
// Run via `pnpm seed:state-officials`. CLI accepts --allow-deactivations=N.

import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadOpenStatesYamlDir } from './openstates-yaml-loader.ts'
import { normalizeStateLegDistrictCode } from './state-leg-config.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const DEFAULT_MIN_STATE_HOUSE_COUNT  = 4500
const DEFAULT_MIN_STATE_SENATE_COUNT = 1800

const DEACTIVATION_THRESHOLD_FRACTION = 0.01
const DEACTIVATION_THRESHOLD_MIN      = 50

export interface IngestStateOfficialsOpts {
  fixturesDir?: string
  minStateHouseCount?: number
  minStateSenateCount?: number
  allowDeactivations?: number
}

export interface IngestStateOfficialsStats {
  officialsUpserted: number
  officesUpserted: number
  unmatchedDistricts: string[]
  errors: string[]
  deactivated: number
}

export async function ingestStateOfficials(
  opts: IngestStateOfficialsOpts = {},
): Promise<IngestStateOfficialsStats> {
  const fixturesDir = opts.fixturesDir
    ?? process.env.OPENSTATES_DATA_DIR
    ?? join(__dirname, 'fixtures', 'openstates-people')
  const minHouse  = opts.minStateHouseCount  ?? DEFAULT_MIN_STATE_HOUSE_COUNT
  const minSenate = opts.minStateSenateCount ?? DEFAULT_MIN_STATE_SENATE_COUNT

  const people = await loadOpenStatesYamlDir(fixturesDir)

  const houseCount  = people.filter(p => p.role.type === 'lower').length
  const senateCount = people.filter(p => p.role.type === 'upper' || p.role.type === 'legislature').length
  if (houseCount < minHouse || senateCount < minSenate) {
    throw new Error(
      `pre-flight count below threshold: lower=${houseCount} (min ${minHouse}), ` +
      `upper+legislature=${senateCount} (min ${minSenate}). ` +
      `Likely cause: openstates/people YAML repo not fully cloned, or fixturesDir is wrong. ` +
      `Aborting with zero DB writes.`,
    )
  }

  const stats: IngestStateOfficialsStats = {
    officialsUpserted: 0,
    officesUpserted: 0,
    unmatchedDistricts: [],
    errors: [],
    deactivated: 0,
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    for (const person of people) {
      const code = normalizeStateLegDistrictCode(
        person.role.state, person.role.type, person.role.district,
      )
      if (!code) {
        stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
        continue
      }

      // District lookup: districts.tier is a separate enum (public.district_tier)
      // from public.official_chamber. district_tier does NOT include
      // 'state_legislature' — NE's unicameral chamber maps to TIGER's
      // state_senate tier (see tiger-state-fips.NO_STATE_HOUSE). So we
      // translate role.type → district_tier here.
      const districtTier =
        person.role.type === 'lower'        ? 'state_house' :
        person.role.type === 'upper'        ? 'state_senate' :
                                              'state_senate'   // unicameral → senate tier

      const districtRow = await client.query<{ id: string }>(
        `select id from public.districts
         where code = $1 and tier = $2::public.district_tier
         limit 1`,
        [code, districtTier],
      )
      if (districtRow.rowCount === 0) {
        stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
        continue
      }
      const districtId = districtRow.rows[0]!.id

      const chamber =
        person.role.type === 'lower'        ? 'state_house' :
        person.role.type === 'upper'        ? 'state_senate' :
                                              'state_legislature'

      const upsert = await client.query<{ id: string }>(`
        insert into public.officials (
          openstates_person_id,
          first_name, last_name, full_name,
          chamber, party, state,
          district_id, district_code, title, senate_class,
          in_office, source_version
        )
        values (
          $1, $2, $3, $4, $5::public.official_chamber, $6, $7,
          $8::uuid, $9, $10, null, true, 'openstates'
        )
        on conflict (openstates_person_id) where openstates_person_id is not null
        do update set
          first_name    = excluded.first_name,
          last_name     = excluded.last_name,
          full_name     = excluded.full_name,
          chamber       = excluded.chamber,
          party         = excluded.party,
          state         = excluded.state,
          district_id   = excluded.district_id,
          district_code = excluded.district_code,
          title         = excluded.title,
          in_office     = true,
          source_version = excluded.source_version
        returning id
      `, [
        person.id,
        person.given_name ?? '',
        person.family_name ?? '',
        person.name,
        chamber,
        person.party,
        person.role.state,
        districtId,
        person.role.district,
        person.role.title,
      ])
      const officialId = upsert.rows[0]!.id
      stats.officialsUpserted += 1

      // Office upsert: clear previous rows for this official, then re-insert.
      // Idempotent: a re-run produces the same district_offices state.
      await client.query(
        'delete from public.district_offices where official_id = $1',
        [officialId],
      )
      for (const office of person.offices) {
        if (!office.address) continue
        // Parse city from "Street, City State" — slice(-2, -1) on a 2-segment
        // split yields the first segment; on a 3+-segment split yields the
        // city. Defensive default '' (text NOT NULL allows empty string).
        const parts = office.address.split(',').map(s => s.trim())
        const city = parts.length >= 3
          ? parts[parts.length - 2] ?? ''
          : parts[0] ?? ''
        await client.query(
          `insert into public.district_offices
             (official_id, address, city, state, phone, source_url)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            officialId,
            office.address,
            city,
            person.role.state,
            office.voice ?? null,
            'https://openstates.org/',
          ],
        )
        stats.officesUpserted += 1
      }
    }

    // Deactivation sweep: any active openstates-sourced official not present
    // in the current ingest set gets in_office = false. Threshold guard
    // mirrors slice 3's officials-ingest.ts.
    const incomingIds = new Set(people.map(p => p.id))
    const allDb = await client.query<{ id: string; openstates_person_id: string }>(`
      select id, openstates_person_id from public.officials
      where openstates_person_id is not null and in_office = true
    `)
    const toDeactivate = allDb.rows.filter(r => !incomingIds.has(r.openstates_person_id))

    const active = allDb.rowCount ?? 0
    const threshold = Math.max(
      DEACTIVATION_THRESHOLD_MIN,
      Math.floor(active * DEACTIVATION_THRESHOLD_FRACTION),
    )
    if (toDeactivate.length > threshold && opts.allowDeactivations !== toDeactivate.length) {
      throw new Error(
        `Refusing to deactivate ${toDeactivate.length} state officials (threshold=${threshold}). ` +
        `Re-run with --allow-deactivations=${toDeactivate.length} to acknowledge.`,
      )
    }
    if (toDeactivate.length > 0) {
      const ids = toDeactivate.map(r => r.id)
      await client.query(
        'update public.officials set in_office = false where id = any($1::uuid[])',
        [ids],
      )
      stats.deactivated = toDeactivate.length
    }
  } finally {
    await client.end()
  }

  return stats
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const allowDeactArg = process.argv.find(a => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowDeactArg
    ? Number(allowDeactArg.split('=')[1])
    : undefined
  ingestStateOfficials({ allowDeactivations })
    .then(stats => {
      console.log('Ingest summary (state officials):')
      console.log(`  officials upserted: ${stats.officialsUpserted}`)
      console.log(`  offices upserted:   ${stats.officesUpserted}`)
      console.log(`  unmatched:          ${stats.unmatchedDistricts.length}`)
      console.log(`  errors:             ${stats.errors.length}`)
      console.log(`  deactivated:        ${stats.deactivated}`)
      if (stats.unmatchedDistricts.length > 0) {
        console.log('  unmatched districts (first 20):')
        for (const u of stats.unmatchedDistricts.slice(0, 20)) console.log(`    - ${u}`)
      }
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => {
      console.error(err.message)
      process.exit(1)
    })
}
