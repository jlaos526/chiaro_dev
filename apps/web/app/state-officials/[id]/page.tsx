import { redirect } from 'next/navigation'
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query'
import {
  fetchOfficial,
  fetchOfficialDistrictOffices,
  isStateLevel,
  officialsKeys,
  fetchOfficialMetrics,
  fetchOfficialStateFinanceSummary,
  fetchOfficialStateDonors,
  fetchOfficialStateScorecardRatings,
  fetchOfficialStateTownHalls,
  fetchOfficialStateDistrictOffices,
  fetchOfficialStateCommitteeHearings,
  fetchOfficialStateFinancialDisclosures,
  fetchOfficialStateEthicsComplaints,
  fetchOfficialStateOfficialEvents,
} from '@chiaro/officials'
import {
  stateBillsKeys,
  fetchOfficialStateVotes,
  fetchOfficialSponsoredStateBills,
} from '@chiaro/state-bills'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { StateOfficialDetailClient } from './StateOfficialDetailClient'

interface Params {
  id: string
}

export default async function StateOfficialPage({
  params,
}: {
  params: Promise<Params>
}): Promise<React.JSX.Element> {
  const { id } = await params
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) redirect('/sign-in')

  let official
  try {
    official = await fetchOfficial(supabase, id)
  } catch {
    redirect('/')
  }
  // Cross-route guard: federal IDs land on /officials/[id]
  if (!isStateLevel(official.chamber)) {
    redirect(`/officials/${id}`)
  }

  // Slice 79 (audit C4): prefetch every query the state cards fire on mount
  // (same key factories + fetchers as the hooks) and dehydrate — the shared
  // StateOfficialDetailPage's ~12 client round-trips hydrate instantly. The
  // subject-gated votes query and per-user issue RPCs stay client-side
  // (spec D1).
  const qc = new QueryClient()
  const [offices] = await Promise.all([
    fetchOfficialDistrictOffices(supabase, id),
    qc.prefetchQuery({
      queryKey: officialsKeys.metrics(id),
      queryFn: () => fetchOfficialMetrics(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: stateBillsKeys.byOfficialVotes(id),
      queryFn: () => fetchOfficialStateVotes(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: stateBillsKeys.byOfficialSponsored(id),
      queryFn: () => fetchOfficialSponsoredStateBills(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateFinanceSummary(id),
      queryFn: () => fetchOfficialStateFinanceSummary(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateDonors(id),
      queryFn: () => fetchOfficialStateDonors(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateScorecardRatings(id),
      queryFn: () => fetchOfficialStateScorecardRatings(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateTownHalls(id),
      queryFn: () => fetchOfficialStateTownHalls(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateDistrictOffices(id),
      queryFn: () => fetchOfficialStateDistrictOffices(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateCommitteeHearings(id),
      queryFn: () => fetchOfficialStateCommitteeHearings(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateFinancialDisclosures(id),
      queryFn: () => fetchOfficialStateFinancialDisclosures(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateEthicsComplaints(id),
      queryFn: () => fetchOfficialStateEthicsComplaints(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stateOfficialEvents(id),
      queryFn: () => fetchOfficialStateOfficialEvents(supabase, id),
    }),
  ])
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <StateOfficialDetailClient official={official} offices={offices} />
    </HydrationBoundary>
  )
}
