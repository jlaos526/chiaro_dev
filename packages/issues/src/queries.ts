import type { ChiaroClient } from '@chiaro/supabase-client'
import type {
  IssueTopic,
  RepAlignment,
  RepWatchlistFlag,
  UserIssueSelectionRow,
} from './types.ts'

export async function fetchCatalog(client: ChiaroClient): Promise<IssueTopic[]> {
  // Slice 79 (audit C18): one request — lenses ride as an embed on topics.
  // The embedded `lenses.active` filter (no `!inner`) trims lens rows WITHOUT
  // dropping lens-less topics, matching the old two-query + client-side-group
  // behavior. Per-embed ordering via the alias referencedTable. The FK hint is
  // REQUIRED: user_issue_selections FKs both tables, so PostgREST also detects
  // a many-to-many candidate between topics and lenses through it and errors
  // as ambiguous without the hint.
  const { data, error } = await client
    .from('issue_topics')
    .select('*, lenses:issue_lenses!issue_lenses_topic_slug_fkey(*)')
    .eq('active', true)
    .eq('lenses.active', true)
    .order('display_order')
    .order('display_order', { referencedTable: 'lenses' })
    .returns<IssueTopic[]>()
  if (error) throw error
  return data ?? []
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
