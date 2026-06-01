import type { ChiaroClient } from '@chiaro/supabase-client'
import type { SaveSelectionsPayload } from './schemas.ts'

export async function saveSelections(client: ChiaroClient, selections: SaveSelectionsPayload): Promise<void> {
  const { error } = await client.rpc('save_user_issue_selections', { p_selections: selections })
  if (error) throw error
}
