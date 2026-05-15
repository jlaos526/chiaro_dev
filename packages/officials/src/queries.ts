import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from './types.ts'

const SELECT_WITH_DISTRICT =
  '*, district:districts!officials_district_id_fkey(id,tier,state,code,name)'

export async function fetchMyOfficials(
  client: ChiaroClient,
): Promise<OfficialWithDistrict[]> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return []

  const { data: districtIds, error: dErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', user.id)
  if (dErr) throw dErr
  if (!districtIds || districtIds.length === 0) return []

  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('in_office', true)
    .in('district_id', districtIds.map((d) => d.district_id))
    .order('chamber', { ascending: true })
    .order('last_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as OfficialWithDistrict[]
}

export async function fetchOfficial(
  client: ChiaroClient,
  id: string,
): Promise<OfficialWithDistrict> {
  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as OfficialWithDistrict
}
