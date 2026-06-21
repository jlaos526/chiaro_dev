import { resolveUserId, type ChiaroClient } from '@chiaro/supabase-client'

export async function getMyProfile(client: ChiaroClient, userId?: string) {
  const uid = await resolveUserId(client, userId)
  if (!uid) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, username, completed, created_at, updated_at')
    .eq('id', uid)
    .single()
  if (error) throw error
  return data
}
