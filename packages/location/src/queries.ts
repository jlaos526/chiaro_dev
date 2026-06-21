import { resolveUserId, type ChiaroClient } from '@chiaro/supabase-client'
import type { DistrictRow, UserLocationRow } from './types.ts'

export async function getMyLocation(client: ChiaroClient, userId?: string): Promise<UserLocationRow | null> {
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
  if (error) throw error
  if (!data) return null
  return data as unknown as UserLocationRow
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

export async function getMyDistricts(client: ChiaroClient, userId?: string): Promise<DistrictRow[]> {
  const uid = await resolveUserId(client, userId)
  if (!uid) return []

  // Two-step: fetch user_district join keys, then bulk-load districts (avoids
  // PostgREST nested-select shape constraints with geometry columns).
  const { data: links, error: linksErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', uid)
  if (linksErr) throw linksErr
  if (!links || links.length === 0) return []

  const ids = links.map((l: { district_id: string }) => l.district_id)
  const { data, error } = await client
    .from('districts_geojson')
    .select('id, tier, state, code, name, geometry')
    .in('id', ids)
  if (error) throw error
  return (data ?? []) as unknown as DistrictRow[]
}
