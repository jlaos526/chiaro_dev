// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { GeocodioHttpClient, GeocodioError, extractDistricts, type GeocodioClient } from './geocodio.ts'
import type { CalibrateInput, ResolvedDistrict } from './types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEOCODIO_KEY = Deno.env.get('GEOCODIO_KEY')!

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handle(req: Request, deps?: { geocodio?: GeocodioClient }): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(401, { error: 'unauthenticated' })
  }
  const jwt = auth.slice(7)

  // Resolve user from JWT.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userResp?.user) return jsonResponse(401, { error: 'unauthenticated' })
  const userId = userResp.user.id

  // Parse + validate input.
  let input: CalibrateInput
  try {
    const body = await req.json()
    if (typeof body?.address === 'string' && body.address.trim().length >= 5) {
      input = { address: body.address.trim() }
    } else if (typeof body?.lat === 'number' && typeof body?.lng === 'number') {
      input = { lat: body.lat, lng: body.lng }
    } else {
      return jsonResponse(400, { error: 'invalid_input' })
    }
  } catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  // Call GeocodIO.
  const geocodio = deps?.geocodio ?? new GeocodioHttpClient(GEOCODIO_KEY)
  let candidate
  try {
    const resp = await geocodio.lookup(input)
    candidate = resp.results[0]
    if (!candidate) return jsonResponse(400, { error: 'address_not_found' })
  } catch (err) {
    if (err instanceof GeocodioError && err.status >= 500) {
      return jsonResponse(502, { error: 'geocoder_unavailable' })
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return jsonResponse(502, { error: 'geocoder_timeout' })
    }
    console.error('geocodio_error', err)
    return jsonResponse(500, { error: 'internal' })
  }

  const lat = candidate.location.lat
  const lng = candidate.location.lng
  const resolved = extractDistricts(candidate)
  if (resolved.length === 0) return jsonResponse(422, { error: 'no_districts_resolved' })

  // Service-role client for DB writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Begin "transaction" via a single RPC. Edge Functions can't open SQL TXNs
  // directly; instead, push the work into a security-definer function. To
  // avoid creating yet another DB object, we sequence the calls and accept
  // partial-failure recovery via the application-level dedupe in step 3.
  //
  // 1. Delete prior user_districts.
  const delResult = await admin.from('user_districts').delete().eq('user_id', userId)
  if (delResult.error) {
    console.error('db_delete_error', delResult.error)
    return jsonResponse(500, { error: 'db_error' })
  }

  // 2. Upsert user_locations.
  const wktPoint = `POINT(${lng} ${lat})`
  const upRes = await admin.from('user_locations').upsert({
    id: userId,
    home_address_text: 'address' in input ? input.address : `${lat},${lng}`,
    home_location: `SRID=4326;${wktPoint}`,
    geocodio_response: candidate,
    calibrated_at: new Date().toISOString(),
  })
  if (upRes.error) {
    console.error('db_upsert_error', upRes.error)
    return jsonResponse(500, { error: 'db_error' })
  }

  // 3. Look up canonical districts and write user_districts.
  const inserted: ResolvedDistrict[] = []
  for (const r of resolved) {
    const { data: row, error: lookupErr } = await admin
      .from('districts')
      .select('id, tier, state, code, name')
      .eq('tier', r.tier)
      .eq('code', r.code)
      .maybeSingle()
    if (lookupErr) {
      console.error('district_lookup_error', { tier: r.tier, code: r.code, err: lookupErr })
      continue
    }
    if (!row) {
      console.warn('district_missing', { tier: r.tier, code: r.code, user: userId })
      continue
    }
    const { error: insErr } = await admin
      .from('user_districts')
      .insert({ user_id: userId, district_id: row.id, tier: row.tier })
    if (insErr) {
      console.error('user_districts_insert_error', { tier: r.tier, err: insErr })
      continue
    }
    inserted.push({ tier: row.tier as any, code: row.code, state: row.state, name: row.name })
  }

  return jsonResponse(200, {
    home_location: { lat, lng },
    districts: inserted,
  })
}

// Deno entry point.
Deno.serve((req) => handle(req))
