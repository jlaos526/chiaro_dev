#!/usr/bin/env tsx
// Slice 4: fetch unitedstates/congress-legislators YAML and populate:
//   - officials.opensecrets_id, officials.fec_candidate_id
//   - officials_leadership_history rows
//   - district_offices rows

import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'
import { parse as parseYAML } from 'yaml'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const LEGISLATORS_CURRENT_URL =
  'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml'
const DISTRICT_OFFICES_URL =
  'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-district-offices.yaml'

interface Legislator {
  id: { bioguide: string; opensecrets?: string; fec?: string[] }
  leadership_roles?: Array<{ title: string; chamber: string; start: string; end?: string }>
}

interface DistrictOfficeBlock {
  id: { bioguide: string }
  offices: Array<{ address?: string; suite?: string; building?: string; city?: string; state?: string; zip?: string; phone?: string }>
}

interface IngestArgs {
  legislatorsYaml?: string
  officesYaml?: string
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return await res.text()
}

export async function ingestLegislators(args: IngestArgs = {}): Promise<{
  updatedOfficials: number
  leadershipRows: number
  officeRows: number
}> {
  const legislatorsYamlText = args.legislatorsYaml ?? await fetchText(LEGISLATORS_CURRENT_URL)
  const officesYamlText     = args.officesYaml     ?? await fetchText(DISTRICT_OFFICES_URL)

  const legislators = parseYAML(legislatorsYamlText) as Legislator[]
  const officeBlocks = parseYAML(officesYamlText)   as DistrictOfficeBlock[]

  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  let updatedOfficials = 0
  let leadershipRows = 0
  let officeRows = 0

  try {
    await client.query('BEGIN')

    for (const leg of legislators) {
      const bioguide = leg.id.bioguide
      const opensecrets = leg.id.opensecrets ?? null
      const fec         = (leg.id.fec && leg.id.fec[0]) ?? null
      // coalesce preserves any existing ID when the YAML drops the field;
      // re-runs cannot null out an ID upstream removed (intentional).
      const res = await client.query(
        `update public.officials
         set opensecrets_id = coalesce($2, opensecrets_id),
             fec_candidate_id = coalesce($3, fec_candidate_id)
         where bioguide_id = $1`,
        [bioguide, opensecrets, fec],
      )
      if ((res.rowCount ?? 0) > 0) updatedOfficials++

      await client.query(
        `delete from public.officials_leadership_history
         where official_id = (select id from public.officials where bioguide_id = $1)`,
        [bioguide],
      )
      for (const role of leg.leadership_roles ?? []) {
        // unitedstates/congress-legislators YAML stores chamber as plain
        // 'house' / 'senate'; the DB enum is now federal_*. Map here.
        let chamberValue: 'federal_house' | 'federal_senate'
        if (role.chamber === 'house') {
          chamberValue = 'federal_house'
        } else if (role.chamber === 'senate') {
          chamberValue = 'federal_senate'
        } else {
          console.warn(`Skipping leadership role with unsupported chamber=${role.chamber} for ${bioguide} (${role.title})`)
          continue
        }
        const r = await client.query(
          `insert into public.officials_leadership_history
             (official_id, role, chamber, party, start_date, end_date, source_url)
           select id, $2, $3::public.official_chamber, party, $4, $5,
             'https://github.com/unitedstates/congress-legislators/blob/main/legislators-current.yaml'
           from public.officials where bioguide_id = $1
           returning id`,
          [bioguide, role.title, chamberValue, role.start, role.end ?? null],
        )
        leadershipRows += r.rowCount ?? 0
      }
    }

    for (const block of officeBlocks) {
      const bioguide = block.id.bioguide
      await client.query(
        `delete from public.district_offices
         where official_id = (select id from public.officials where bioguide_id = $1)`,
        [bioguide],
      )
      for (const off of block.offices ?? []) {
        if (!off.address || !off.city || !off.state) continue
        const r = await client.query(
          `insert into public.district_offices
             (official_id, address, city, state, zip, phone, source_url)
           select id, $2, $3, $4, $5, $6,
             'https://github.com/unitedstates/congress-legislators/blob/main/legislators-district-offices.yaml'
           from public.officials where bioguide_id = $1
           returning id`,
          [bioguide, off.address, off.city, off.state, off.zip ?? null, off.phone ?? null],
        )
        officeRows += r.rowCount ?? 0
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }

  return { updatedOfficials, leadershipRows, officeRows }
}

if (isCliEntry(import.meta.url)) {
  ingestLegislators()
    .then((stats) => {
      console.log(JSON.stringify(stats, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('Legislators ingest failed:', err)
      process.exit(2)
    })
}
