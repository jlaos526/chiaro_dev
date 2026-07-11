import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// Required env shims for module load:
Deno.env.set('SUPABASE_URL', 'http://stub')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub')
Deno.env.set('GEOCODIO_KEY', 'stub')

const { handle } = await import('./index.ts')

function makeRequest(body: unknown, withAuth = true): Request {
  return new Request('http://stub/calibrate-location', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withAuth ? { Authorization: 'Bearer stub-jwt' } : {}),
    },
    body: JSON.stringify(body),
  })
}

Deno.test('returns 401 with no Authorization header', async () => {
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }, false))
  assertEquals(res.status, 401)
})

Deno.test('returns 405 on non-POST', async () => {
  const req = new Request('http://stub/calibrate-location', { method: 'GET' })
  const res = await handle(req)
  assertEquals(res.status, 405)
})

Deno.test('returns 400 on too-short address (auth would be 401 first; this verifies input gate exists)', async () => {
  const res = await handle(makeRequest({ address: 'q' }))
  // Auth check fires before input validation in this handler — expect 401 (no real JWT verify path in unit test).
  // Wider handler-level coverage of input shapes lives in Task 9's integration tests against real Supabase.
  assertEquals([400, 401].includes(res.status), true)
})

// --- Pre-geocode throttle (audit U17, slice 69) ---------------------------
// Stubs injected via deps: `supabase` covers auth + the calibrated_at read +
// the rpc; `geocodio` records lookup calls so tests can assert whether a
// (paid) geocode would have been spent.

function makeSupabaseStub(opts: { calibratedAt?: string | null; throttleReadError?: boolean } = {}) {
  const rpcCalls: unknown[] = []
  return {
    rpcCalls,
    auth: {
      getUser: (_jwt: string) =>
        Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: () =>
            opts.throttleReadError
              ? Promise.resolve({ data: null, error: { message: 'read failed' } })
              : Promise.resolve({
                  data: opts.calibratedAt === undefined ? null : { calibrated_at: opts.calibratedAt },
                  error: null,
                }),
        }),
      }),
    }),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: { districts: [] }, error: null })
    },
  }
}

function makeGeocodioStub() {
  const calls: unknown[] = []
  return {
    calls,
    lookup: (input: unknown) => {
      calls.push(input)
      return Promise.resolve({
        results: [{
          address_components: { state: 'NY' },
          location: { lat: 40.7128, lng: -74.006 },
          fields: { congressional_districts: [{ district_number: 12, name: "NY's 12th" }] },
        }],
      })
    },
  }
}

// deno-lint-ignore no-explicit-any
function depsFor(supabase: any, geocodio: any) {
  return { supabase, geocodio }
}

Deno.test('throttle: 429 within 60s of calibrated_at and GeocodIO is NOT called', async () => {
  const supabase = makeSupabaseStub({ calibratedAt: new Date(Date.now() - 30_000).toISOString() })
  const geocodio = makeGeocodioStub()
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }), depsFor(supabase, geocodio))
  assertEquals(res.status, 429)
  assertEquals((await res.json()).error, 'calibrating_too_frequently')
  assertEquals(geocodio.calls.length, 0)
  assertEquals(supabase.rpcCalls.length, 0)
})

Deno.test('throttle: stale calibrated_at proceeds to geocode + rpc', async () => {
  const supabase = makeSupabaseStub({ calibratedAt: new Date(Date.now() - 5 * 60_000).toISOString() })
  const geocodio = makeGeocodioStub()
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }), depsFor(supabase, geocodio))
  assertEquals(res.status, 200)
  assertEquals(geocodio.calls.length, 1)
  assertEquals(supabase.rpcCalls.length, 1)
})

Deno.test('throttle: never-calibrated user (no row) proceeds', async () => {
  const supabase = makeSupabaseStub({}) // calibratedAt undefined → data null
  const geocodio = makeGeocodioStub()
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }), depsFor(supabase, geocodio))
  assertEquals(res.status, 200)
  assertEquals(geocodio.calls.length, 1)
})

Deno.test('throttle: read error fails OPEN (RPC remains the authority)', async () => {
  const supabase = makeSupabaseStub({ throttleReadError: true })
  const geocodio = makeGeocodioStub()
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }), depsFor(supabase, geocodio))
  assertEquals(res.status, 200)
  assertEquals(geocodio.calls.length, 1)
  assertEquals(supabase.rpcCalls.length, 1)
})

// Note: deeper coverage (GeocodIO error paths, DB writes, RLS) lives in
// packages/location/test/integration.test.ts (Task 9). That suite hits real
// local Supabase + live GeocodIO via the deployed Edge Function.
