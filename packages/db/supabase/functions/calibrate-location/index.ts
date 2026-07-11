// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { GeocodioHttpClient, GeocodioError, extractDistricts, type GeocodioClient } from './geocodio.ts'
import type { CalibrateInput } from './types.ts'
import { withSentry, Sentry } from '../_shared/sentry.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEOCODIO_KEY = Deno.env.get('GEOCODIO_KEY')!

// Mirrors apply_calibration's default `app.calibrate_throttle_seconds` (0008).
// The RPC's per-session GUC override applies only to the RPC itself; this
// pre-check always uses the 60s default.
const CALIBRATE_THROTTLE_MS = 60_000

// CORS (slice 71, audit C48): Edge Functions do NOT get CORS headers from the
// Supabase gateway (verified live 2026-07-11 — a browser preflight OPTIONS
// reached this function and got the bare 405). supabase-js functions.invoke
// always sends Authorization + apikey, which forces a preflight, so browser
// calibrate breaks without this. '*' is the Supabase-docs pattern: auth is a
// Bearer header (not cookies), so a foreign origin can't ride a user session.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
} as const

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

export async function handle(
  req: Request,
  deps?: { geocodio?: GeocodioClient; supabase?: any },
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(401, { error: 'unauthenticated' })
  }
  const jwt = auth.slice(7)

  // Service-role key + user JWT as Authorization → PostgREST runs requests
  // as the authenticated user; auth.uid() inside SECURITY DEFINER resolves
  // to the JWT's subject. Used for auth verification, the throttle pre-check,
  // and the RPC call.
  const client = deps?.supabase ?? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userResp, error: userErr } = await client.auth.getUser(jwt)
  if (userErr || !userResp?.user) return jsonResponse(401, { error: 'unauthenticated' })

  // Parse + validate input.
  let input: CalibrateInput
  try {
    const body = await req.json()
    if (typeof body?.address === 'string' && body.address.trim().length >= 5) {
      input = { address: body.address.trim() }
    } else if (
      // C48 adjunct: typeof NaN === 'number', so the old gate admitted
      // NaN/Infinity/out-of-range coords and burned a GeocodIO call on them.
      Number.isFinite(body?.lat) && Number.isFinite(body?.lng) &&
      body.lat >= -90 && body.lat <= 90 &&
      body.lng >= -180 && body.lng <= 180
    ) {
      input = { lat: body.lat, lng: body.lng }
    } else {
      return jsonResponse(400, { error: 'invalid_input' })
    }
  } catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  // Pre-geocode throttle (audit U17, slice 69). apply_calibration owns the
  // authoritative 60s rate limit (0008), but it runs AFTER the GeocodIO call —
  // without this check every request spent a paid geocode credit before any
  // 429 could fire. Read the same user_locations.calibrated_at the RPC checks
  // (RLS: self-scoped select, 0005) and short-circuit first. Fail-open on
  // read errors — the RPC still enforces the limit atomically.
  try {
    const { data: loc, error: locErr } = await client
      .from('user_locations')
      .select('calibrated_at')
      .eq('id', userResp.user.id)
      .maybeSingle()
    if (!locErr && loc?.calibrated_at) {
      const last = Date.parse(loc.calibrated_at)
      if (Number.isFinite(last) && Date.now() - last < CALIBRATE_THROTTLE_MS) {
        return jsonResponse(429, { error: 'calibrating_too_frequently' })
      }
    }
  } catch (err) {
    console.warn('throttle_precheck_failed', err)
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
    Sentry.captureException(err)
    console.error('geocodio_error', err)
    return jsonResponse(500, { error: 'internal' })
  }

  const lat = candidate.location.lat
  const lng = candidate.location.lng
  const resolved = extractDistricts(candidate)
  if (resolved.length === 0) return jsonResponse(422, { error: 'no_districts_resolved' })

  // Atomic write via SECURITY DEFINER RPC. The function owns the rate limit
  // and runs the delete/upsert/insert as a single PostgreSQL transaction —
  // any failure rolls back the whole calibration attempt.
  const rpcResult = await (client as any).rpc('apply_calibration', {
    p_address_text: 'address' in input ? input.address : `${lat},${lng}`,
    p_lat: lat,
    p_lng: lng,
    p_geocodio_response: candidate,
    p_resolved: resolved,
  })

  if (rpcResult.error) {
    const msg = rpcResult.error.message ?? ''
    if (msg.includes('calibrating_too_frequently')) {
      return jsonResponse(429, { error: 'calibrating_too_frequently' })
    }
    if (msg.includes('unauthenticated')) {
      return jsonResponse(401, { error: 'unauthenticated' })
    }
    Sentry.captureException(new Error(rpcResult.error.message ?? 'rpc_error'))
    console.error('rpc_error', rpcResult.error)
    return jsonResponse(500, { error: 'db_error' })
  }

  return jsonResponse(200, rpcResult.data)
}

// Deno entry point.
Deno.serve(withSentry((req) => handle(req)))
