import { View, Text, ScrollView } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import { ComingSoonCard, type ComingSoonCategory } from '@/components/cards/ComingSoonCard'
import type { OfficialWithDistrict } from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { StateServiceRecordCard } from './StateServiceRecordCard'
import { StateFinanceCard } from './StateFinanceCard'

type DistrictOffice = Database['public']['Tables']['district_offices']['Row']

// 'Service Record' + 'Finance' are now rendered with real data; the remaining
// 3 categories stay as ComingSoonCard placeholders until 5F.
const PLACEHOLDER_CATEGORIES: ComingSoonCategory[] = [
  'Issue Positions',
  'Community Presence',
  'Ethics & Accountability',
]

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  // covers state_senate + state_legislature (Nebraska unicameral renders as Senate-shape)
  return 'State Senator'
}

export function StateOfficialDetailPage({
  official,
  offices,
}: {
  official: OfficialWithDistrict
  offices: DistrictOffice[]
}) {
  const districtCode = official.district?.code ?? official.district_code ?? ''
  const title = official.title ?? null

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Bio header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.brand.text }}>
          {official.full_name}
        </Text>
        {title && (
          <Text
            testID="official-title"
            style={{
              marginTop: 4,
              fontSize: 13,
              fontStyle: 'italic',
              color: COLORS.neutral.textMuted,
            }}
          >
            {title}
          </Text>
        )}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>
            {chamberLabel(official.chamber)}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>·</Text>
          <Text style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>
            {official.party}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>·</Text>
          <Text style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>
            {districtCode}
          </Text>
        </View>
      </View>

      {/* Offices contact section — real data, between bio and placeholder cascade */}
      {offices.length > 0 && (
        <View testID="offices-section" style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: COLORS.brand.text }}>
            Offices
          </Text>
          {offices.map(office => (
            <View
              key={office.id}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: COLORS.neutral.border,
                borderRadius: 8,
                marginBottom: 8,
                backgroundColor: COLORS.neutral.surface,
              }}
            >
              <Text style={{ color: COLORS.brand.text }}>{office.address}</Text>
              {office.phone && (
                <Text style={{ marginTop: 4, color: COLORS.neutral.textMuted }}>
                  {office.phone}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Category cascade — real Service Record + Finance + 3 ComingSoonCard placeholders */}
      <View style={{ gap: 12 }}>
        <StateServiceRecordCard official={official} />
        <StateFinanceCard official={official} />
        {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
      </View>
    </ScrollView>
  )
}
