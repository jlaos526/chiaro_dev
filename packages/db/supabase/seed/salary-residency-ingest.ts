#!/usr/bin/env tsx
import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'
import { lookupSalary, CONGRESSIONAL_SALARY_SOURCE } from './congressional-salary-schedule.ts'
import { fetchCandidateAddress } from './openfec-adapter.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const GEOCODIO_BASE = 'https://api.geocod.io/v1.7'

export interface IngestArgs {
  openfecApiKey?:   string
  geocodioKey?:     string
  addressFetcher?:  typeof fetchCandidateAddress
  geocoder?:        (address: string, key: string) => Promise<{ lat: number; lng: number } | null>
}

async function defaultGeocoder(address: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `${GEOCODIO_BASE}/geocode?q=${encodeURIComponent(address)}&api_key=${key}`
  )
  if (!res.ok) return null
  const json = await res.json() as any
  const loc = json.results?.[0]?.location
  if (!loc) return null
  return { lat: loc.lat, lng: loc.lng }
}

export async function ingestSalaryAndResidency(args: IngestArgs) {
  const openfec  = args.openfecApiKey  ?? process.env.OPENFEC_API_KEY ?? ''
  const geocodio = args.geocodioKey    ?? process.env.GEOCODIO_KEY    ?? ''
  const fetcher  = args.addressFetcher ?? fetchCandidateAddress
  const geo      = args.geocoder       ?? defaultGeocoder

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  const stats = { officialsProcessed: 0, salariesSet: 0, residencyResolved: 0, residencyMissing: 0 }

  try {
    await client.query('BEGIN')

    // 1. SALARY: look up each official's current leadership role + map to salary
    const officials = await client.query<{
      id: string; bioguide_id: string; chamber: string;
      district_id: string; fec_candidate_id: string | null;
    }>(`select id, bioguide_id, chamber, district_id, fec_candidate_id from public.officials where in_office = true`)

    for (const o of officials.rows) {
      stats.officialsProcessed++

      // Current leadership role: most recent open-ended entry
      const lead = await client.query<{ role: string }>(
        `select role from public.officials_leadership_history
         where official_id = $1 and end_date is null
         order by start_date desc limit 1`,
        [o.id])
      const { amount, role } = lookupSalary(lead.rows[0]?.role)
      await client.query(`
        insert into public.official_metrics (official_id, congress, salary_usd, salary_role)
        values ($1, '119', $2, $3)
        on conflict (official_id) do update set
          salary_usd = excluded.salary_usd,
          salary_role = excluded.salary_role,
          congress = excluded.congress,
          computed_at = now()
      `, [o.id, amount, role])
      stats.salariesSet++

      // 2. RESIDENCY (house only meaningful per spec; senators get a documented N/A path)
      if (o.chamber !== 'federal_house') {
        await client.query(`
          update public.official_metrics
          set lives_in_district = null,
              home_district_id  = null
          where official_id = $1
        `, [o.id])
        continue
      }
      if (!o.fec_candidate_id) {
        stats.residencyMissing++
        continue
      }
      const addr = await fetcher(o.fec_candidate_id, openfec)
      if (!addr) { stats.residencyMissing++; continue }

      // Geocode (via injectable seam; default uses GeocodIO)
      const loc = await geo(`${addr.address1}, ${addr.city}, ${addr.state} ${addr.zip}`, geocodio)
      if (!loc) { stats.residencyMissing++; continue }

      // Spatial: which house district contains this point?
      const home = await client.query<{ id: string }>(`
        select id from public.districts
        where tier = 'federal_house' and state = $1
          and st_contains(geometry::geometry, st_setsrid(st_makepoint($2, $3), 4326))
        limit 1
      `, [addr.state, loc.lng, loc.lat])

      const homeDistrictId = home.rows[0]?.id ?? null
      const livesInDistrict = homeDistrictId === o.district_id

      await client.query(`
        update public.official_metrics
        set lives_in_district = $2,
            home_district_id  = $3
        where official_id = $1
      `, [o.id, livesInDistrict, homeDistrictId])
      stats.residencyResolved++

      // Note: loc.lat / loc.lng NOT persisted anywhere. Discarded after this iteration.
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }

  return { ...stats, salary_source_url: CONGRESSIONAL_SALARY_SOURCE }
}

if (isCliEntry(import.meta.url)) {
  ingestSalaryAndResidency({})
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
