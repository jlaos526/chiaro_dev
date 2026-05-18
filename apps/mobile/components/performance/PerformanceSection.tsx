import { View, Text } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialScorecardRatings,
  useOfficialFinance,
  useOfficialStockTransactions,
  useOfficialLeadershipHistory,
} from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { useExpandedState } from './useExpandedState'
import { useExpoParamSync } from './useExpoParamSync'
import { CategoryBar } from './CategoryBar'
import { ServiceRecordCategory } from './categories/ServiceRecordCategory'
import { IssuePositionsCategory } from './categories/IssuePositionsCategory'
import { CommunityPresenceCategory } from './categories/CommunityPresenceCategory'
import { FinanceCategory } from './categories/FinanceCategory'
import { EthicsAccountabilityCategory } from './categories/EthicsAccountabilityCategory'
import { VotingBillsCategory } from './categories/VotingBillsCategory'
import {
  serviceRecordTeaser,
  issuePositionsTeaser,
  communityPresenceTeaser,
  financeTeaser,
  ethicsAccountabilityTeaser,
  votingBillsTeaser,
} from '@/lib/derivations/teasers'
import { firstElectedYear } from '@/lib/derivations/service-record'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'

const ORDER: CategoryId[] = [
  'service-record',
  'issue-positions',
  'community-presence',
  'finance',
  'ethics-accountability',
  'voting-bills',
]

const CYCLE = '2024'

export function PerformanceSection({
  officialId,
  chamber,
}: {
  officialId: string
  chamber: 'house' | 'senate'
}): React.JSX.Element {
  const expanded = useExpandedState()
  useExpoParamSync(expanded)

  const metrics = useOfficialMetrics(supabase, officialId)
  const scorecards = useOfficialScorecardRatings(supabase, officialId)
  const finance = useOfficialFinance(supabase, officialId, CYCLE)
  const stock = useOfficialStockTransactions(supabase, officialId)
  const leadership = useOfficialLeadershipHistory(supabase, officialId)

  const m = metrics.data
  const ratings = scorecards.data ?? []
  const topChips = selectTopAlignmentChips(ratings)
  const topAligned = topChips.find(c => c.tier === 'strongly-aligned' || c.tier === 'mostly-aligned')?.issueArea ?? null
  const topDiffer = topChips.find(c => c.tier === 'strongly-differs' || c.tier === 'mostly-differs')?.issueArea ?? null
  const lateTrades = (stock.data ?? []).filter(t => (t.days_late ?? 0) > 0).length
  const recentHalls = m?.town_halls_count ?? 0

  const teasers: Record<CategoryId, string | null> = {
    'service-record': serviceRecordTeaser({
      role: m?.salary_role ?? null,
      firstElectedYear: firstElectedYear(leadership.data ?? []),
    }),
    'issue-positions': issuePositionsTeaser({ topAlignedIssue: topAligned, topDifferIssue: topDiffer }),
    'community-presence': communityPresenceTeaser({
      livesInDistrict: m?.lives_in_district ?? null,
      officeCount: m?.district_offices_count ?? 0,
      recentTownHallCount: recentHalls,
    }),
    'finance': financeTeaser({
      totalRaised: finance.data?.summary.total_raised ?? null,
      topIndustry: finance.data?.industries[0]?.industry ?? null,
    }),
    'ethics-accountability': ethicsAccountabilityTeaser({
      lateTrades,
      inStatePct: m?.in_state_donations_pct ?? null,
    }),
    'voting-bills': votingBillsTeaser({
      attendancePct: m?.attendance_pct ?? null,
      billsThisCongress: (m?.bills_sponsored_count ?? 0) + (m?.bills_cosponsored_count ?? 0),
    }),
  }

  const subCascade = { isOpen: expanded.isSubCascadeOpen, onToggle: expanded.toggleSubCascade }

  function bodyFor(id: CategoryId): React.JSX.Element {
    switch (id) {
      case 'service-record':        return <ServiceRecordCategory officialId={officialId} />
      case 'issue-positions':       return <IssuePositionsCategory officialId={officialId} subCascade={subCascade} />
      case 'community-presence':    return <CommunityPresenceCategory officialId={officialId} chamber={chamber} />
      case 'finance':               return <FinanceCategory officialId={officialId} subCascade={subCascade} />
      case 'ethics-accountability': return <EthicsAccountabilityCategory officialId={officialId} />
      case 'voting-bills':          return <VotingBillsCategory officialId={officialId} subCascade={subCascade} />
    }
  }

  return (
    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1714', marginBottom: 12 }}>
        Performance — 119th Congress
      </Text>
      {ORDER.map(id => {
        const open = expanded.isCategoryOpen(id)
        return (
          <View key={id}>
            <CategoryBar
              categoryId={id}
              teaser={teasers[id]}
              open={open}
              onToggle={() => expanded.toggleCategory(id)}
            />
            {open ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#d8d4c9',
                  borderTopWidth: 0,
                  borderLeftWidth: 2,
                  borderLeftColor: CATEGORY_ACCENT[id],
                  borderBottomLeftRadius: 6,
                  borderBottomRightRadius: 6,
                  backgroundColor: '#fafaf6',
                  marginBottom: 6,
                }}
              >
                {bodyFor(id)}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
