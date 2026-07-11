#!/usr/bin/env tsx
// Audit helper: pre-calibrate the most-recently-signed-up auth user to
// Pelosi's SF home address, bypassing the Edge Function so the audit can
// proceed without the calibrate-location function's GEOCODIO_KEY plumbing.
//
// Usage:
//   pnpm --filter @chiaro/db exec tsx supabase/seed/audit-calibrate-latest-user.ts
//
// Inserts a user_locations row + matching user_districts links via the pg
// service role (RLS is revoked from authenticated for these tables).

import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// SF City Hall, near Pelosi's CA-11 district.
const HOME_LAT = 37.7793
const HOME_LNG = -122.4193
const HOME_ADDRESS = '1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102'

async function main(): Promise<void> {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  try {
    const u = await client.query<{ id: string; email: string }>(
      `select id, email from auth.users order by created_at desc limit 1`,
    )
    if (u.rows.length === 0) {
      console.error('No auth.users found — sign up via /sign-up first.')
      process.exit(2)
    }
    const user = u.rows[0]!
    console.log(`Calibrating user ${user.email} (${user.id}) to SF home address.`)

    await client.query('BEGIN')

    // 1. user_locations upsert
    await client.query(
      `insert into public.user_locations (id, home_address_text, home_location, geocodio_response, calibrated_at)
         values ($1, $2,
           ('SRID=4326;POINT(' || $4::text || ' ' || $3::text || ')')::geography,
           $5::jsonb, now())
         on conflict (id) do update set
           home_address_text = excluded.home_address_text,
           home_location = excluded.home_location,
           geocodio_response = excluded.geocodio_response,
           calibrated_at = excluded.calibrated_at`,
      [user.id, HOME_ADDRESS, HOME_LAT, HOME_LNG, JSON.stringify({ audit_fixture: true })],
    )

    // 2. user_districts links — point-in-polygon match across all tiers
    await client.query(`delete from public.user_districts where user_id = $1`, [user.id])
    await client.query(
      `insert into public.user_districts (user_id, district_id, tier)
         select $1::uuid, d.id, d.tier
         from public.districts d
         where st_contains(
           d.geometry::geometry,
           st_setsrid(st_makepoint($3, $2), 4326)
         )`,
      [user.id, HOME_LAT, HOME_LNG],
    )

    const matched = await client.query<{ tier: string; code: string; name: string }>(
      `select d.tier::text, d.code, d.name
         from public.user_districts ud
         join public.districts d on d.id = ud.district_id
         where ud.user_id = $1
         order by d.tier`,
      [user.id],
    )

    await client.query('COMMIT')

    console.log(`\nCalibration complete. ${matched.rows.length} districts matched:`)
    for (const r of matched.rows)
      console.log(`  ${r.tier.padEnd(16)} ${r.code.padEnd(10)} ${r.name}`)
    console.log(`\nReload http://localhost:3000 — middleware should now let you through.`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }
}

if (isCliEntry(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
