import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  FederalServiceRecordCard,
  FederalCommunityPresenceCard,
  FederalFinanceCard,
  FederalIssuePositionsCard,
  FederalEthicsAccountabilityCard,
  FederalVotingBillsCard,
} from '@chiaro/officials-ui'
import { BioHeaderClient } from './BioHeaderClient'
import { RepAlignmentSectionClient } from './RepAlignmentSectionClient'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query'
import {
  CURRENT_CONGRESS,
  CURRENT_CYCLE,
  isStateLevel,
  STATE_NAMES,
  officialsKeys,
  fetchOfficialMetrics,
  fetchOfficialScorecardRatings,
  fetchOfficialLeadershipHistory,
  fetchOfficialFinance,
  fetchOfficialTownHalls,
  fetchOfficialDistrictOffices,
  fetchOfficialStockTransactions,
  fetchOfficialHoldings,
  fetchOfficialDisclosureOther,
} from '@chiaro/officials'
import {
  billsKeys,
  votesKeys,
  fetchOfficialSponsoredBillsCount,
  fetchOfficialCosponsoredBillsCount,
  fetchOfficialMissedVotesCount,
} from '@chiaro/bills'
import type { Database } from '@chiaro/db'

interface Params {
  id: string
}

type OfficialRow = Database['public']['Tables']['officials']['Row']
type DistrictRow = Database['public']['Tables']['districts']['Row']
type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

interface DistrictParts {
  districtNumber: number | null
  atLarge: boolean
}

function parseDistrictCode(
  chamber: OfficialRow['chamber'],
  code: string | null | undefined,
): DistrictParts {
  if (chamber !== 'federal_house' || !code) return { districtNumber: null, atLarge: false }
  // House codes: STATE-XX (zero-padded number) or STATE-AL (at-large)
  const suffix = code.split('-')[1]
  if (!suffix) return { districtNumber: null, atLarge: false }
  if (suffix === 'AL') return { districtNumber: null, atLarge: true }
  const num = Number.parseInt(suffix, 10)
  return Number.isFinite(num)
    ? { districtNumber: num, atLarge: false }
    : { districtNumber: null, atLarge: false }
}

interface BuildBioInput {
  official: OfficialRow
  districtCode: string | null
  role: string
  firstElectedYearValue: number | null
}

function deriveBioProps(input: BuildBioInput) {
  const { official, districtCode, role, firstElectedYearValue } = input
  const { districtNumber, atLarge } = parseDistrictCode(official.chamber, districtCode)
  return {
    fullName: official.full_name,
    portraitUrl: official.portrait_url,
    party: official.party,
    // BioHeader is federal-only — slice-3 only loads federal officials.
    // State officials get their own detail route + components later in slice-5C.
    chamber: official.chamber as 'federal_house' | 'federal_senate',
    state: official.state,
    stateName: STATE_NAMES[official.state] ?? official.state,
    districtNumber,
    senateClass: (official.senate_class ?? null) as 1 | 2 | 3 | null,
    atLarge,
    role,
    firstElectedYear: firstElectedYearValue,
    officialUrl: official.official_url,
    twitterHandle: official.twitter_handle,
  }
}

export default async function OfficialPage({
  params,
}: {
  params: Promise<Params>
}): Promise<React.JSX.Element> {
  const { id } = await params
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) redirect('/sign-in')

  const { data: official } = await supabase
    .from('officials')
    .select('*')
    .eq('id', id)
    .single<OfficialRow>()
  if (!official) redirect('/')

  // Cross-route guard: state IDs land on /state-officials/[id]
  if (isStateLevel(official.chamber)) redirect(`/state-officials/${id}`)

  // Slice 79 (audit C4): per-request QueryClient — every query the 6 cards
  // fire unconditionally on mount is prefetched HERE (server sits next to
  // Supabase) and dehydrated, so the client hooks hydrate instantly instead
  // of firing ~11 PostgREST round-trips after the bundle loads. Same key
  // factories + fetchers as the hooks — the contract that keeps them in sync.
  // Leadership + scorecards use fetchQuery because the bio composition below
  // needs the data too (audit C18c: the old page hand-fetched them AND the
  // cards re-fetched identical data client-side); `.catch(() => [])`
  // preserves the old error-tolerance (empty section, not a 500). The
  // S75-gated full-row bill/vote queries and the per-user issue RPCs are
  // deliberately NOT prefetched (spec D1).
  const qc = new QueryClient()
  const [districtRes, leadershipRows, scorecards] = await Promise.all([
    supabase
      .from('districts')
      .select('code')
      .eq('id', official.district_id)
      .single<Pick<DistrictRow, 'code'>>(),
    qc
      .fetchQuery({
        queryKey: officialsKeys.leadershipHistory(id),
        queryFn: () => fetchOfficialLeadershipHistory(supabase, id),
      })
      .catch(() => [] as LeadershipRow[]),
    qc
      .fetchQuery({
        queryKey: officialsKeys.scorecards(id),
        queryFn: () => fetchOfficialScorecardRatings(supabase, id),
      })
      .catch(() => []),
    qc.prefetchQuery({
      queryKey: officialsKeys.metrics(id),
      queryFn: () => fetchOfficialMetrics(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.finance(id, CURRENT_CYCLE),
      queryFn: () => fetchOfficialFinance(supabase, id, CURRENT_CYCLE),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.townHalls(id, CURRENT_CONGRESS),
      queryFn: () => fetchOfficialTownHalls(supabase, id, CURRENT_CONGRESS),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.districtOffices(id),
      queryFn: () => fetchOfficialDistrictOffices(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.stockTransactions(id),
      queryFn: () => fetchOfficialStockTransactions(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.holdings(id),
      queryFn: () => fetchOfficialHoldings(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: officialsKeys.disclosureOther(id),
      queryFn: () => fetchOfficialDisclosureOther(supabase, id),
    }),
    qc.prefetchQuery({
      queryKey: billsKeys.officialSponsoredCount(id, CURRENT_CONGRESS),
      queryFn: () => fetchOfficialSponsoredBillsCount(supabase, id, CURRENT_CONGRESS),
    }),
    qc.prefetchQuery({
      queryKey: billsKeys.officialCosponsoredCount(id, CURRENT_CONGRESS),
      queryFn: () => fetchOfficialCosponsoredBillsCount(supabase, id, CURRENT_CONGRESS),
    }),
    qc.prefetchQuery({
      queryKey: votesKeys.officialMissedCount(id, CURRENT_CONGRESS),
      queryFn: () => fetchOfficialMissedVotesCount(supabase, id, CURRENT_CONGRESS),
    }),
  ])

  const district = districtRes.data
  const chips = selectTopAlignmentChips(scorecards as Parameters<typeof selectTopAlignmentChips>[0])
  const currentRole =
    leadershipRows.find((r) => r.end_date == null)?.role ??
    (official.chamber === 'federal_house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadershipRows)

  const bioProps = deriveBioProps({
    official,
    districtCode: district?.code ?? null,
    role: currentRole,
    firstElectedYearValue,
  })

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <main>
        <BioHeaderClient officialId={official.id} {...bioProps} chips={chips} />
        {/* Personalized rep alignment strip (slice 52) */}
        <div style={{ marginBottom: 12 }}>
          <RepAlignmentSectionClient officialId={official.id} repName={official.full_name} />
        </div>
        {/* Federal officials redesign (slice 6) — 6 cards in vertical cascade */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FederalServiceRecordCard
            officialId={id}
            {...(official.chamber === 'federal_senate' ? { hideLivesInDistrict: true } : {})}
          />
          <FederalCommunityPresenceCard officialId={id} congress={CURRENT_CONGRESS} />
          <FederalFinanceCard officialId={id} cycle={CURRENT_CYCLE} />
          <FederalIssuePositionsCard officialId={id} />
          <FederalEthicsAccountabilityCard officialId={id} />
          <FederalVotingBillsCard officialId={id} congress={CURRENT_CONGRESS} />
        </div>
      </main>
    </HydrationBoundary>
  )
}
