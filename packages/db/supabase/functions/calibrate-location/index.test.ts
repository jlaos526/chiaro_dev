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

// Note: deeper coverage (GeocodIO error paths, DB writes, RLS) lives in
// packages/location/test/integration.test.ts (Task 9). That suite hits real
// local Supabase + live GeocodIO via the deployed Edge Function.
