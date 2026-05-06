import type { ChiaroClient } from '@chiaro/supabase-client'
import type { DistrictRow, UserLocationRow } from './types.ts'

export async function getMyLocation(client: ChiaroClient): Promise<UserLocationRow | null> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  // PostgREST returns geometry columns as PostGIS WKB hex by default. The
  // home_location column is small (a single Point), so callers that need
  // GeoJSON parse it themselves — see `districts_geojson` (added in
  // migration 0007) for the analogous pattern on districts.
  const { data, error } = await client
    .from('user_locations')
    .select('home_address_text, home_location, calibrated_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return data as unknown as UserLocationRow
}

export async function getMyDistricts(client: ChiaroClient): Promise<DistrictRow[]> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return []

  // Two-step: fetch user_district join keys, then bulk-load districts (avoids
  // PostgREST nested-select shape constraints with geometry columns).
  const { data: links, error: linksErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', user.id)
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
