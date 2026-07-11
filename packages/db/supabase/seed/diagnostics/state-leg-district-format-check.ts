#!/usr/bin/env tsx
/**
 * Slice 27 audit diagnostic: prints state-leg district code patterns
 * + legislator district_id NULL counts. Run against local Supabase
 * after `pnpm seed:tiger` (and optionally `pnpm seed:state-officials`)
 * to verify the format mismatch documented in
 * docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md.
 *
 * Exit code 0 if NO mismatch detected; non-zero if any state_senate or
 * state_house row has a code that doesn't match the TIGER
 * ${state}-SS-${num} / ${state}-SH-${num} format.
 *
 * Slice 28 reruns this script as part of the verify gate to confirm
 * the producer/consumer alignment fix lands.
 */
import { Client } from 'pg'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

async function main(): Promise<void> {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    // 1. District code format check — sample patterns per tier
    const codes = await client.query<{ tier: string; code_pattern: string; n: number }>(`
      select tier,
             substring(code from 1 for 6) as code_pattern,
             count(*)::int as n
      from public.districts
      where tier in ('state_senate','state_house')
      group by tier, code_pattern
      order by tier, code_pattern
    `)
    console.log('-- District code patterns --')
    console.table(codes.rows)

    // 2. Legislator district_id NULL counts per chamber
    const legs = await client.query<{
      chamber: string
      total: number
      populated: number
      null_count: number
    }>(`
      select chamber,
             count(*)::int as total,
             count(district_id)::int as populated,
             (count(*) - count(district_id))::int as null_count
      from public.officials
      where chamber in ('state_senate','state_house','state_legislature')
      group by chamber
      order by chamber
    `)
    console.log('-- Legislator district_id population --')
    console.table(legs.rows)

    // 3. Exit code: nonzero if any state_senate/state_house code is
    //    missing the SS/SH prefix
    const malformed = await client.query<{ n: number }>(`
      select count(*)::int as n
      from public.districts
      where (tier = 'state_senate' and code not like '%-SS-%')
         or (tier = 'state_house'  and code not like '%-SH-%')
    `)
    const malformedCount = malformed.rows[0]?.n ?? 0
    if (malformedCount > 0) {
      console.error(`\nFAIL: ${malformedCount} district rows with non-TIGER-format codes.`)
      process.exit(1)
    }
    console.log(`\nOK: all state-leg districts use TIGER format.`)
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(2)
})
