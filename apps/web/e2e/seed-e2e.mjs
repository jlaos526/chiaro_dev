// Slice 83 (spec D2): idempotent E2E fixtures — districts CONTAINING SF City
// Hall (the S79.5 sample calibrate address) + officials attached to them +
// one scorecard rating. ON CONFLICT DO NOTHING on districts by (tier, code)
// followed by a lookup, so a TIGER-seeded local DB reuses its REAL rows (no
// unique violation — the slice-67 collision lesson) while the bare CI DB
// gets these fixture polygons. Officials upsert by external id.
//
// Usage: SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node apps/web/e2e/seed-e2e.mjs
import pg from 'pg'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// A generous box around SF City Hall (-122.4194, 37.7793).
const SF_BOX =
  'MULTIPOLYGON(((-122.60 37.60, -122.20 37.60, -122.20 37.95, -122.60 37.95, -122.60 37.60)))'

const DISTRICTS = [
  { tier: 'federal_house', state: 'CA', code: 'CA-11', name: 'California 11th' },
  { tier: 'federal_senate', state: 'CA', code: 'CA-S1', name: 'California (Senate seat 1)' },
  { tier: 'federal_senate', state: 'CA', code: 'CA-S2', name: 'California (Senate seat 2)' },
  { tier: 'state_senate', state: 'CA', code: 'CA-SS-11', name: 'CA Senate District 11' },
  { tier: 'state_house', state: 'CA', code: 'CA-SH-17', name: 'CA Assembly District 17' },
]

async function main() {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()

  const districtId = {}
  for (const d of DISTRICTS) {
    await client.query(
      `insert into public.districts (tier, state, code, name, geometry, source_version)
       values ($1, $2, $3, $4, ST_GeogFromText($5), 'E2E')
       on conflict (tier, code) do nothing`,
      [d.tier, d.state, d.code, d.name, SF_BOX],
    )
    const { rows } = await client.query(
      'select id from public.districts where tier = $1 and code = $2',
      [d.tier, d.code],
    )
    districtId[d.code] = rows[0].id
  }

  const officials = [
    {
      key: { col: 'bioguide_id', val: 'E2EHOUSE1' },
      row: {
        bioguide_id: 'E2EHOUSE1',
        first_name: 'Harper',
        last_name: 'Housefixture',
        full_name: 'Harper Housefixture',
        chamber: 'federal_house',
        party: 'D',
        state: 'CA',
        district_id: districtId['CA-11'],
        senate_class: null,
      },
    },
    {
      key: { col: 'bioguide_id', val: 'E2ESEN1' },
      row: {
        bioguide_id: 'E2ESEN1',
        first_name: 'Selby',
        last_name: 'Senatefixture',
        full_name: 'Selby Senatefixture',
        chamber: 'federal_senate',
        party: 'D',
        state: 'CA',
        district_id: districtId['CA-S1'],
        senate_class: 1,
      },
    },
    {
      key: { col: 'openstates_person_id', val: 'ocd-person/e2e-asm-1' },
      row: {
        openstates_person_id: 'ocd-person/e2e-asm-1',
        first_name: 'Avery',
        last_name: 'Assemblyfixture',
        full_name: 'Avery Assemblyfixture',
        chamber: 'state_house',
        party: 'Democratic',
        state: 'CA',
        district_id: districtId['CA-SH-17'],
        district_code: '17',
        title: 'Assemblymember',
        senate_class: null,
      },
    },
  ]

  const officialId = {}
  for (const o of officials) {
    const cols = Object.keys(o.row)
    const vals = cols.map((_, i) => `$${i + 1}`)
    const updates = cols
      .filter((c) => c !== o.key.col)
      .map((c) => `${c} = excluded.${c}`)
      .join(', ')
    const { rows } = await client.query(
      `insert into public.officials (${cols.join(', ')}, in_office, source_version)
       values (${vals.join(', ')}, true, 'E2E')
       on conflict (${o.key.col}) where ${o.key.col} is not null
         do update set ${updates}, in_office = true
       returning id`,
      cols.map((c) => o.row[c]),
    )
    officialId[o.key.val] = rows[0].id
  }

  // One scorecard org + rating so the detail page's Issue Positions card and
  // the home card's alignment chips have data.
  const { rows: orgRows } = await client.query(
    `insert into public.scorecard_orgs (slug, name, issue_area, methodology_url, scoring_max)
     values ('e2e-env-org', 'E2E Environment Org', 'environment', 'https://example.org', 100)
     on conflict (slug) do update set name = excluded.name
     returning id`,
  )
  await client.query(
    `insert into public.scorecard_ratings (scorecard_id, official_id, congress, score, source_url)
     values ($1, $2, '119', 92, 'https://example.org')
     on conflict (scorecard_id, official_id, congress) do update set score = excluded.score`,
    [orgRows[0].id, officialId['E2EHOUSE1']],
  )

  console.log(
    `e2e fixtures ready: ${DISTRICTS.length} districts, ${officials.length} officials, 1 rating`,
  )
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
