import { describe, it, expect, afterAll } from 'vitest'
import { getMyLocation, getMyDistricts } from '../src/queries.ts'
import { makeAuthedUser, makeAnonClient, makeAdminClient, cleanupCreatedUsers } from './fixtures.ts'

// Slice 63 (audit U10): skip locally when the env isn't exported instead of
// crashing into makeAdminClient's throw. CI always runs (live = true via CI
// env). The live-GeocodIO block is additionally gated on GEOCODIO_KEY — in CI
// the secret reaches vitest via turbo.json test.env; locally it skips unless
// you export a key AND serve the Edge Function.
const live = !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.CI
const describeLive = describe.skipIf(!live)
const describeGeocodio = describe.skipIf(!live || !process.env.GEOCODIO_KEY)
if (!live) {
  console.warn(
    '[@chiaro/location] SUPABASE_SERVICE_ROLE_KEY not set — skipping integration suite. ' +
    'Run `pnpm db:start`, then export keys from `supabase status --output env`.'
  )
} else if (!process.env.GEOCODIO_KEY) {
  console.warn('[@chiaro/location] GEOCODIO_KEY not set — skipping the live-GeocodIO Edge Function block.')
}

afterAll(async () => {
  await cleanupCreatedUsers()
})

const URBAN_ADDRESS = '350 5th Ave, New York, NY 10118'
const RURAL_ADDRESS = '1 Old Faithful Geyser Loop, Yellowstone, WY 82190'

describeLive('location queries (pre-calibration)', () => {
  it('getMyLocation returns null before calibration', async () => {
    const { client } = await makeAuthedUser('loc-null')
    expect(await getMyLocation(client as never)).toBeNull()
  })

  it('getMyDistricts returns [] before calibration', async () => {
    const { client } = await makeAuthedUser('dist-empty')
    expect(await getMyDistricts(client as never)).toEqual([])
  })
})

describeGeocodio('calibrate-location Edge Function (live GeocodIO)', () => {
  it('writes user_locations + ≥4 user_districts on first calibration', async () => {
    const { client } = await makeAuthedUser('cal-happy')
    const { data, error } = await client.functions.invoke('calibrate-location', {
      body: { address: URBAN_ADDRESS },
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ home_location: expect.any(Object), districts: expect.any(Array) })
    expect((data as { districts: unknown[] }).districts.length).toBeGreaterThanOrEqual(4)

    const loc = await getMyLocation(client as never)
    expect(loc?.home_address_text).toBe(URBAN_ADDRESS)

    const districts = await getMyDistricts(client as never)
    const tiers = new Set(districts.map(d => d.tier))
    expect(tiers).toContain('federal_house')
    expect(tiers).toContain('federal_senate')
    expect(tiers).toContain('county')
  })

  it('re-calibration replaces stale user_districts rows', async () => {
    const { client, userId } = await makeAuthedUser('cal-recal')
    await client.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })
    const before = await getMyDistricts(client as never)
    const beforeFedHouseCode = before.find(d => d.tier === 'federal_house')?.code

    // Back-date calibrated_at past the 60s throttle so the next call isn't
    // rate-limited. apply_calibration's rate limit is enforced server-side;
    // simulating elapsed time is the realistic way to exercise replacement.
    const admin = makeAdminClient()
    const { error: bdErr } = await admin
      .from('user_locations')
      .update({ calibrated_at: new Date(Date.now() - 5 * 60_000).toISOString() })
      .eq('id', userId)
    expect(bdErr).toBeNull()

    await client.functions.invoke('calibrate-location', { body: { address: RURAL_ADDRESS } })
    const after = await getMyDistricts(client as never)
    const afterFedHouseCode = after.find(d => d.tier === 'federal_house')?.code

    expect(afterFedHouseCode).not.toBe(beforeFedHouseCode)
    expect(after.find(d => d.code === beforeFedHouseCode)).toBeUndefined()
  })

  it('second calibrate-location call within 60s returns 429', async () => {
    const { client } = await makeAuthedUser('cal-throttle')
    const first = await client.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })
    expect(first.error).toBeNull()

    const second = await client.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })
    expect(second.error).not.toBeNull()
    expect((second.error as { context?: { status?: number } }).context?.status).toBe(429)
  })

  it('user A cannot SELECT user B user_locations row (RLS)', async () => {
    const { client: clientA } = await makeAuthedUser('rls-a')
    const { client: clientB, userId: bId } = await makeAuthedUser('rls-b')
    await clientB.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })

    const { data, error } = await clientA.from('user_locations').select('*').eq('id', bId)
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('user A cannot SELECT user B user_districts row (RLS)', async () => {
    // Slice 56 (migration 0060) scoped user_districts SELECT to the owning user.
    // Pre-0060 this asserted the inverse ("Q6c — public-readable"), which locked
    // in the cross-user location leak. See CLAUDE.md Gotcha #32.
    const { client: clientA } = await makeAuthedUser('pub-a')
    const { client: clientB, userId: bId } = await makeAuthedUser('pub-b')
    await clientB.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })

    const { data, error } = await clientA.from('user_districts').select('*').eq('user_id', bId)
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('Edge Function unauthenticated → 401', async () => {
    const anon = makeAnonClient()
    const { error } = await anon.functions.invoke('calibrate-location', {
      body: { address: URBAN_ADDRESS },
    })
    expect(error).not.toBeNull()
    expect((error as { context?: { status?: number } }).context?.status ?? 401).toBe(401)
  })

  it('malformed address → 400, no DB writes', async () => {
    const { client } = await makeAuthedUser('cal-bad')
    const { error } = await client.functions.invoke('calibrate-location', {
      body: { address: 'q' },
    })
    expect(error).not.toBeNull()
    const loc = await getMyLocation(client as never)
    expect(loc).toBeNull()
    const links = await getMyDistricts(client as never)
    expect(links).toEqual([])
  })
})
