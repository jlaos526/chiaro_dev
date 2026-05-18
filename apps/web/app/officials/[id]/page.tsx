import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BioHeader } from '@/components/bio/BioHeader'
import { PerformanceSection } from '@/components/performance/PerformanceSection'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import type { Database } from '@chiaro/db'

interface Params { id: string }

type OfficialRow = Database['public']['Tables']['officials']['Row']
type DistrictRow = Database['public']['Tables']['districts']['Row']
type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

interface DistrictParts {
  districtNumber: number | null
  atLarge: boolean
}

function parseDistrictCode(chamber: OfficialRow['chamber'], code: string | null | undefined): DistrictParts {
  if (chamber !== 'house' || !code) return { districtNumber: null, atLarge: false }
  // House codes: STATE-XX (zero-padded number) or STATE-AL (at-large)
  const suffix = code.split('-')[1]
  if (!suffix) return { districtNumber: null, atLarge: false }
  if (suffix === 'AL') return { districtNumber: null, atLarge: true }
  const num = Number.parseInt(suffix, 10)
  return Number.isFinite(num) ? { districtNumber: num, atLarge: false } : { districtNumber: null, atLarge: false }
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
    chamber: official.chamber,
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

export default async function OfficialPage(
  { params }: { params: Promise<Params> },
): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: official } = await supabase
    .from('officials')
    .select('*')
    .eq('id', id)
    .single<OfficialRow>()
  if (!official) redirect('/')

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
  const currentRole = leadershipRows.find((r) => r.end_date == null)?.role
    ?? (official.chamber === 'house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadershipRows)

  const bioProps = deriveBioProps({
    official,
    districtCode: district?.code ?? null,
    role: currentRole,
    firstElectedYearValue,
  })

  return (
    <main>
      <BioHeader officialId={official.id} {...bioProps} chips={chips} />
      <PerformanceSection officialId={id} chamber={official.chamber as 'house' | 'senate'} />
    </main>
  )
}
