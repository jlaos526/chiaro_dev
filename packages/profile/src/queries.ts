import type { ChiaroClient } from '@chiaro/supabase-client'

export async function getMyProfile(client: ChiaroClient) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, username, completed, created_at, updated_at')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}
