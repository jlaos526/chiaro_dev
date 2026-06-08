import { Drawer } from 'expo-router/drawer'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, Redirect, useRouter } from 'expo-router'
import { useOfficial, useOfficialScorecardRatings, useOfficialLeadershipHistory, isStateLevel, STATE_NAMES } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { firstElectedYear as deriveFirstElectedYear } from '@/lib/derivations/service-record'
import {
  BioHeader,
  RepAlignmentSection,
  FederalServiceRecordCard,
  FederalCommunityPresenceCard,
  FederalFinanceCard,
  FederalIssuePositionsCard,
  FederalEthicsAccountabilityCard,
  FederalVotingBillsCard,
  useBrandTokens,
} from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'

const CURRENT_CYCLE = '2024'
const CURRENT_CONGRESS = '119'

function parseDistrictCode(chamber: string, code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (chamber !== 'federal_house' || !code) return { districtNumber: null, atLarge: false }
  if (code.endsWith('-AL')) return { districtNumber: null, atLarge: true }
  const parts = code.split('-')
  const tail = parts[1]
  const n = tail ? parseInt(tail, 10) : NaN
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

export default function OfficialDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const officialId = id ?? ''
  const officialQ = useOfficial(supabase, officialId)
  const leadershipQ = useOfficialLeadershipHistory(supabase, officialId)
  const scorecardsQ = useOfficialScorecardRatings(supabase, officialId)
  const { semantic } = useBrandTokens()

  if (officialQ.isLoading) return <Text>Loading…</Text>
  if (!officialQ.data) return <Text>Not found</Text>

  // Cross-route guard: state-level IDs land on /state-officials/[id]
  if (isStateLevel(officialQ.data.chamber)) {
    return <Redirect href={`/state-officials/${officialId}` as never} />
  }

  const official = officialQ.data
  const leadership = leadershipQ.data ?? []
  const chips = selectTopAlignmentChips(scorecardsQ.data ?? [])
  const currentRole = leadership.find(r => r.end_date == null)?.role
    ?? (official.chamber === 'federal_house' ? 'Representative' : 'Senator')
  const firstElectedYearValue = deriveFirstElectedYear(leadership)
  const districtCode = official.district?.code ?? null
  const { districtNumber, atLarge } = parseDistrictCode(official.chamber, districtCode)

  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Official',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: semantic.bg.app }}>
      <ScrollView>
        <BioHeader
          officialId={official.id}
          fullName={official.full_name}
          portraitUrl={official.portrait_url}
          party={official.party}
          chamber={official.chamber as 'federal_house' | 'federal_senate'}
          state={official.state}
          stateName={STATE_NAMES[official.state] ?? official.state}
          districtNumber={districtNumber}
          senateClass={(official.senate_class ?? null) as 1 | 2 | 3 | null}
          atLarge={atLarge}
          role={currentRole}
          firstElectedYear={firstElectedYearValue}
          officialUrl={official.official_url}
          twitterHandle={official.twitter_handle}
          chips={chips}
          onChipPress={(chip) =>
            router.push(`/officials/${officialId}?cat=issue-positions&sub=${chip.subCascadeSlug}` as never)
          }
        />
        {/* Personalized rep alignment strip (slice 52) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <RepAlignmentSection
            officialId={official.id}
            repName={official.full_name}
            onSetup={() => router.push('/issues' as never)}
          />
        </View>
        {/* Federal officials redesign (slice 6) — 6 cards in vertical cascade */}
        <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
          <FederalServiceRecordCard
            officialId={officialId}
            {...(official.chamber === 'federal_senate' ? { hideLivesInDistrict: true } : {})}
          />
          <FederalCommunityPresenceCard officialId={officialId} congress={CURRENT_CONGRESS} />
          <FederalFinanceCard officialId={officialId} cycle={CURRENT_CYCLE} />
          <FederalIssuePositionsCard officialId={officialId} />
          <FederalEthicsAccountabilityCard officialId={officialId} />
          <FederalVotingBillsCard officialId={officialId} congress={CURRENT_CONGRESS} />
        </View>
      </ScrollView>
    </SafeAreaView>
    </>
  )
}
