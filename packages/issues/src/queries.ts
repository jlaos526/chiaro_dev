import type { ChiaroClient } from '@chiaro/supabase-client'
import type {
  IssueTopic,
  IssueLens,
  RepAlignment,
  RepWatchlistFlag,
  UserIssueSelectionRow,
} from './types.ts'

export async function fetchCatalog(client: ChiaroClient): Promise<IssueTopic[]> {
  const { data: topics, error: te } = await client
    .from('issue_topics')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (te) throw te
  const { data: lenses, error: le } = await client
    .from('issue_lenses')
    .select('*')
    .eq('active', true)
    .order('display_order')
    .returns<IssueLens[]>()
  if (le) throw le
  return (topics ?? []).map((t) => ({
    ...t,
    lenses: (lenses ?? []).filter((l) => l.topic_slug === t.slug),
  })) as IssueTopic[]
}

export async function fetchMySelections(client: ChiaroClient): Promise<UserIssueSelectionRow[]> {
  const { data, error } = await client
    .from('user_issue_selections')
    .select('*')
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function fetchRepAlignment(
  client: ChiaroClient,
  officialId: string,
): Promise<RepAlignment | null> {
  const { data, error } = await client.rpc('get_rep_issue_alignment', { p_official_id: officialId })
  if (error) throw error
  return (data as RepAlignment | null) ?? null
}

export async function fetchRepWatchlistFlags(
  client: ChiaroClient,
  officialId: string,
): Promise<RepWatchlistFlag[]> {
  const { data, error } = await client.rpc('get_rep_watchlist_flags', { p_official_id: officialId })
  if (error) throw error
  return (data as RepWatchlistFlag[] | null) ?? []
}
