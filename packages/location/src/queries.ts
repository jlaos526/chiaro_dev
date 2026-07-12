import { resolveUserId, type ChiaroClient } from '@chiaro/supabase-client'
import type { DistrictRow, UserLocationRow } from './types.ts'

export async function getMyLocation(
  client: ChiaroClient,
  userId?: string,
): Promise<UserLocationRow | null> {
  const uid = await resolveUserId(client, userId)
  if (!uid) return null

  // PostgREST returns geometry columns as PostGIS WKB hex by default. The
  // home_location column is small (a single Point), so callers that need
  // GeoJSON parse it themselves — see `districts_geojson` (added in
  // migration 0007) for the analogous pattern on districts.
  const { data, error } = await client
    .from('user_locations')
    .select('home_address_text, home_location, calibrated_at')
    .eq('id', uid)
    .maybeSingle()
    .returns<UserLocationRow | null>()
  if (error) throw error
  return data
}

export async function getMyHomePoint(
  client: ChiaroClient,
  userId?: string,
): Promise<{ lat: number; lng: number } | null> {
  const uid = await resolveUserId(client, userId)
  if (!uid) return null

  // Uses the user_locations_geojson view (migration 0011) which exposes
  // home_location as a proper Point GeoJSON. Avoids parsing the geocodio
  // audit blob the way slice-2 DistrictPanel used to.
  const { data, error } = await client
    .from('user_locations_geojson')
    .select('home_location_geojson')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw error
  const geo = data?.home_location_geojson as
    | { type?: string; coordinates?: [number, number] }
    | null
    | undefined
  if (!geo || geo.type !== 'Point' || !Array.isArray(geo.coordinates)) return null
  const [lng, lat] = geo.coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { lat, lng }
}

export async function getMyDistricts(client: ChiaroClient): Promise<DistrictRow[]> {
  // Single round-trip against the my_districts_geojson view (migration 0062):
  // it self-scopes by auth.uid() (logged out -> no rows -> []) and pre-joins
  // user_districts -> districts_geojson, so no user-id resolution is needed.
  // Unlike the other @chiaro/location fetchers (slice 66 resolveUserId + a
  // userId? param), this one takes no id — the view's auth.uid() filter IS the
  // scoping. The view also emits the shared federal_senate whole-state geometry
  // once (S1/S2 dedupe); shareDedupedGeometry re-attaches it so both seats keep
  // rendering and the returned rows are unchanged for consumers.
  const { data, error } = await client
    .from('my_districts_geojson')
    .select('id, tier, state, code, name, geometry')
    .returns<DistrictRow[]>()
  if (error) throw error
  return shareDedupedGeometry(data ?? [])
}

// The my_districts_geojson view NULLs the geometry of rows that duplicate an
// earlier row's (state, tier) — federal_senate S1/S2 share one whole-state
// polygon — so it crosses the wire once. Re-attach the shared geometry object
// to the deduped sibling so every returned DistrictRow carries geometry and
// downstream consumers (DistrictPanel list + DistrictMap) see no shape change.
function shareDedupedGeometry(rows: DistrictRow[]): DistrictRow[] {
  const geomByKey = new Map<string, DistrictRow['geometry']>()
  for (const r of rows) {
    if (r.geometry) geomByKey.set(`${r.state}:${r.tier}`, r.geometry)
  }
  return rows.map((r) =>
    r.geometry ? r : { ...r, geometry: geomByKey.get(`${r.state}:${r.tier}`)! },
  )
}
