import type { ChiaroClient } from '@chiaro/supabase-client'
import type { IssueTopic, IssueLens, RepAlignment, UserIssueSelectionRow } from './types.ts'

export async function fetchCatalog(client: ChiaroClient): Promise<IssueTopic[]> {
  const { data: topics, error: te } = await client.from('issue_topics').select('*').order('display_order')
  if (te) throw te
  const { data: lenses, error: le } = await client.from('issue_lenses').select('*').order('display_order')
  if (le) throw le
  return (topics ?? []).map((t) => ({
    ...t,
    lenses: ((lenses ?? []) as unknown as IssueLens[]).filter((l) => l.topic_slug === t.slug),
  })) as IssueTopic[]
}

export async function fetchMySelections(client: ChiaroClient): Promise<UserIssueSelectionRow[]> {
  const { data, error } = await client.from('user_issue_selections').select('*').order('display_order')
  if (error) throw error
  return data ?? []
}

export async function fetchRepAlignment(client: ChiaroClient, officialId: string): Promise<RepAlignment | null> {
  const { data, error } = await client.rpc('get_rep_issue_alignment', { p_official_id: officialId })
  if (error) throw error
  return (data as RepAlignment | null) ?? null
}
