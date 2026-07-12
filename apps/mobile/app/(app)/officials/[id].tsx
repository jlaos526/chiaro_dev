import { Drawer } from 'expo-router/drawer'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, Redirect, useRouter } from 'expo-router'
import {
  useOfficial,
  useOfficialScorecardRatings,
  useOfficialLeadershipHistory,
  isStateLevel,
  CURRENT_CONGRESS,
  CURRENT_CYCLE,
  STATE_NAMES,
} from '@chiaro/officials'
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

function parseDistrictCode(
  chamber: string,
  code: string | null | undefined,
): { districtNumber: number | null; atLarge: boolean } {
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

  // Pull-to-refresh (audit U2-rider): broad invalidation is acceptable v1.
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries()
    } finally {
      setRefreshing(false)
    }
  }, [queryClient])

  // Audit U3: loading / not-found branches render inside the same SafeAreaView
  // + brand-bg + header shell as the loaded branch (were bare <Text> under the
  // notch, unreadable in dark mode, with no way to navigate back).
  const statusShell = (message: string) => (
    <>
      <Drawer.Screen
        options={{
          title: 'Official',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: semantic.bg.app }}>
        <Text style={{ padding: 16, color: semantic.text.muted }}>{message}</Text>
      </SafeAreaView>
    </>
  )

  if (officialQ.isLoading) return statusShell('Loading…')
  if (!officialQ.data) return statusShell('Not found')

  // Cross-route guard: state-level IDs land on /state-officials/[id]
  if (isStateLevel(officialQ.data.chamber)) {
    return <Redirect href={`/state-officials/${officialId}` as never} />
  }

  const official = officialQ.data
  const leadership = leadershipQ.data ?? []
  const chips = selectTopAlignmentChips(scorecardsQ.data ?? [])
  const currentRole =
    leadership.find((r) => r.end_date == null)?.role ??
    (official.chamber === 'federal_house' ? 'Representative' : 'Senator')
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
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
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
              router.push(
                `/officials/${officialId}?cat=issue-positions&sub=${chip.subCascadeSlug}` as never,
              )
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
