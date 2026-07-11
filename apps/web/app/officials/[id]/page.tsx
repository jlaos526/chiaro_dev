import { createSupabaseServerClient } from '@/lib/supabase/server'
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
import { isStateLevel, STATE_NAMES } from '@chiaro/officials'
import type { Database } from '@chiaro/db'

const CURRENT_CYCLE = '2024'
const CURRENT_CONGRESS = '119'

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
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: official } = await supabase
    .from('officials')
    .select('*')
    .eq('id', id)
    .single<OfficialRow>()
  if (!official) redirect('/')

  // Cross-route guard: state IDs land on /state-officials/[id]
  if (isStateLevel(official.chamber)) redirect(`/state-officials/${id}`)

  // Parallel fetch: district code + leadership history + scorecard ratings.
  const [districtRes, leadershipRes, scorecardsRes] = await Promise.all([
    supabase
      .from('districts')
      .select('code')
      .eq('id', official.district_id)
      .single<Pick<DistrictRow, 'code'>>(),
    supabase
      .from('officials_leadership_history')
      .select('*')
      .eq('official_id', id)
      .order('start_date', { ascending: false }),
    supabase
      .from('scorecard_ratings')
      .select('*, org:scorecard_orgs(issue_area, scoring_max)')
      .eq('official_id', id),
  ])

  const district = districtRes.data
  const leadershipRows: LeadershipRow[] = (leadershipRes.data ?? []) as LeadershipRow[]
  const scorecards = scorecardsRes.data ?? []
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
  )
}
