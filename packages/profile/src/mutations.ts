import { resolveUserId, type ChiaroClient } from '@chiaro/supabase-client'
import type { ProfileFormInput } from './schema.ts'
import { ProfileError, mapProfileError } from './errors.ts'

export async function updateMyProfile(client: ChiaroClient, input: ProfileFormInput, userId?: string) {
  const uid = await resolveUserId(client, userId)
  if (!uid) throw new ProfileError('Not signed in')
  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: input.display_name,
      username: input.username,
      completed: true,
    })
    .eq('id', uid)
    .select('id, display_name, username, completed, created_at, updated_at')
    .single()
  if (error) throw mapProfileError(error)
  return data
}
