'use client'

import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { OfficialWithDistrict } from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'
import { ComingSoonCard, type ComingSoonCategory } from '../cards/ComingSoonCard.tsx'
import { StateCommunityPresenceCard } from './StateCommunityPresenceCard.tsx'
import { StateConductCard } from './StateConductCard.tsx'
import { StateFinanceCard } from './StateFinanceCard.tsx'
import { StateFinancialActivityCard } from './StateFinancialActivityCard.tsx'
import { StateIssuePositionsCard } from './StateIssuePositionsCard.tsx'
import { StateServiceRecordCard } from './StateServiceRecordCard.tsx'

type DistrictOffice = Database['public']['Tables']['district_offices']['Row']

export interface StateOfficialDetailPageProps {
  official: OfficialWithDistrict
  offices: DistrictOffice[]
}

// State-officials detail-page redesign closed (slice 5I) — all 6 categories
// have real cards backed by ingest data: Service Record, Finance,
// Issue Positions, Community Presence, Financial Activity, and
// Conduct & Sanctions. No ComingSoonCard placeholders remain.
const PLACEHOLDER_CATEGORIES: ComingSoonCategory[] = []

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  // covers state_senate + state_legislature (Nebraska unicameral renders as Senate-shape)
  return 'State Senator'
}

export function StateOfficialDetailPage({
  official,
  offices,
}: StateOfficialDetailPageProps): React.JSX.Element {
  const districtCode = official.district?.code ?? official.district_code ?? ''
  const title = official.title ?? null

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Bio header */}
      <View style={styles.bioBlock}>
        <Text style={styles.name}>{official.full_name}</Text>
        {title && (
          <Text testID="official-title" style={styles.title}>
            {title}
          </Text>
        )}
        <View style={styles.identityRow}>
          <Text style={styles.identityCell}>{chamberLabel(official.chamber)}</Text>
          <Text style={styles.identityCell}>·</Text>
          <Text style={styles.identityCell}>{official.party}</Text>
          <Text style={styles.identityCell}>·</Text>
          <Text style={styles.identityCell}>{districtCode}</Text>
        </View>
      </View>

      {/* Offices contact section — real data, between bio and cascade */}
      {offices.length > 0 && (
        <View testID="offices-section" style={styles.officesSection}>
          <Text style={styles.officesHeading}>Offices</Text>
          {offices.map(office => (
            <View key={office.id} style={styles.officeCard}>
              <Text style={styles.officeAddress}>{office.address}</Text>
              {office.phone && <Text style={styles.officePhone}>{office.phone}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Category cascade — all 6 real cards; redesign closed (slice 5I) */}
      <View style={styles.cascade}>
        <StateServiceRecordCard official={official} />
        <StateFinanceCard official={official} />
        <StateIssuePositionsCard officialId={official.id} />
        <StateCommunityPresenceCard officialId={official.id} />
        <StateFinancialActivityCard officialId={official.id} />
        <StateConductCard officialId={official.id} />
        {PLACEHOLDER_CATEGORIES.map(cat => (
          <ComingSoonCard key={cat} category={cat} />
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  bioBlock: {
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.brand.text,
  },
  title: {
    marginTop: 4,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.neutral.textMuted,
  },
  identityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  identityCell: {
    fontSize: 14,
    color: COLORS.neutral.textMuted,
  },
  officesSection: {
    marginBottom: 24,
  },
  officesHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.brand.text,
  },
  officeCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: COLORS.neutral.surface,
  },
  officeAddress: {
    color: COLORS.brand.text,
  },
  officePhone: {
    marginTop: 4,
    color: COLORS.neutral.textMuted,
  },
  cascade: {
    gap: 12,
  },
})
