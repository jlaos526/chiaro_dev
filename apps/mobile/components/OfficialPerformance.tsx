import { View, Text, ScrollView } from 'react-native'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { ScorecardCard } from './ScorecardCard'
import { FinanceCard } from './FinanceCard'
import { ShowUpWorkloadCard } from './ShowUpWorkloadCard'
import { PositionSalaryCard } from './PositionSalaryCard'
import { ConstituentConnectionCard } from './ConstituentConnectionCard'

export function OfficialPerformance({ officialId }: { officialId: string }) {
  const scorecards = useOfficialScorecardRatings(supabase, officialId)

  return (
    <View style={{ gap: 24, marginTop: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Performance — 119th Congress</Text>

      <View>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Issue stance scorecards
        </Text>
        {scorecards.isLoading ? (
          <Text>Loading…</Text>
        ) : (
          <ScrollView horizontal>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(scorecards.data ?? []).map((r) => (
                <View key={r.id} style={{ width: 220 }}>
                  <ScorecardCard rating={r} officialId={officialId} />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <FinanceCard officialId={officialId} />
      <ShowUpWorkloadCard officialId={officialId} />
      <PositionSalaryCard officialId={officialId} />
      <ConstituentConnectionCard officialId={officialId} />
    </View>
  )
}
