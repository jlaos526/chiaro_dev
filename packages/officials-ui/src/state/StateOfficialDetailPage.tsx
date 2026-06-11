'use client'

import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { RefreshControlProps } from 'react-native'
import type { ReactElement } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'
import { ComingSoonCard, type ComingSoonCategory } from '../cards/ComingSoonCard.tsx'
import { StateCommunityPresenceCard } from './StateCommunityPresenceCard.tsx'
import { StateConductCard } from './StateConductCard.tsx'
import { StateFinanceCard } from './StateFinanceCard.tsx'
import { StateFinancialActivityCard } from './StateFinancialActivityCard.tsx'
import { StateIssuePositionsCard } from './StateIssuePositionsCard.tsx'
import { StateServiceRecordCard } from './StateServiceRecordCard.tsx'
import { RepAlignmentSection } from '../issues/RepAlignmentSection.tsx'

type DistrictOffice = Database['public']['Tables']['district_offices']['Row']

export interface StateOfficialDetailPageProps {
  official: OfficialWithDistrict
  offices: DistrictOffice[]
  /**
   * Navigate into the `/issues` flow. When supplied, a personalized
   * {@link RepAlignmentSection} renders under the bio block; omitted (e.g. in
   * unit tests that don't exercise alignment) it is skipped entirely.
   */
  onSetupIssues?: () => void
  /**
   * Web: `href` for the alignment strip's setup CTA so it renders a real `<a>`
   * (middle-click → new tab etc.). Plain left-click still routes via
   * `onSetupIssues`. Omitted on native → the `<Pressable>` CTA.
   */
  setupIssuesHref?: string
  /**
   * Native-only: passed through to the underlying ScrollView so the host
   * screen can wire pull-to-refresh (audit U2-rider). Never applied on web —
   * RefreshControl is unsupported on RNW.
   */
  refreshControl?: ReactElement<RefreshControlProps>
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
  onSetupIssues,
  setupIssuesHref,
  refreshControl,
}: StateOfficialDetailPageProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const districtCode = official.district?.code ?? official.district_code ?? ''
  const title = official.title ?? null

  const nameStyle = [styles.name, { color: semantic.text.primary }]
  const titleStyle = [styles.title, { color: semantic.text.muted }]
  const identityCellStyle = [styles.identityCell, { color: semantic.text.muted }]
  const officesHeadingStyle = [styles.officesHeading, { color: semantic.text.primary }]
  const officeCardStyle = [
    styles.officeCard,
    { borderColor: semantic.border.default, backgroundColor: semantic.bg.app },
  ]
  const officeAddressStyle = [styles.officeAddress, { color: semantic.text.primary }]
  const officePhoneStyle = [styles.officePhone, { color: semantic.text.muted }]

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      {...(Platform.OS !== 'web' && refreshControl ? { refreshControl } : {})}
    >
      {/* Bio header */}
      <View style={styles.bioBlock}>
        <Text style={nameStyle}>{official.full_name}</Text>
        {title && (
          <Text testID="official-title" style={titleStyle}>
            {title}
          </Text>
        )}
        <View style={styles.identityRow}>
          <Text style={identityCellStyle}>{chamberLabel(official.chamber)}</Text>
          <Text style={identityCellStyle}>·</Text>
          <Text style={identityCellStyle}>{official.party}</Text>
          <Text style={identityCellStyle}>·</Text>
          <Text style={identityCellStyle}>{districtCode}</Text>
        </View>
      </View>

      {/* Personalized rep alignment strip (slice 52) — only when the host app
          wires the /issues nav callback. */}
      {onSetupIssues && (
        <View style={styles.alignmentBlock}>
          <RepAlignmentSection
            officialId={official.id}
            repName={official.full_name}
            onSetup={onSetupIssues}
            {...(setupIssuesHref ? { setupHref: setupIssuesHref } : {})}
          />
        </View>
      )}

      {/* Offices contact section — real data, between bio and cascade */}
      {offices.length > 0 && (
        <View testID="offices-section" style={styles.officesSection}>
          <Text style={officesHeadingStyle}>Offices</Text>
          {offices.map(office => (
            <View key={office.id} style={officeCardStyle}>
              <Text style={officeAddressStyle}>{office.address}</Text>
              {office.phone && <Text style={officePhoneStyle}>{office.phone}</Text>}
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
  alignmentBlock: {
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    marginTop: 4,
    fontSize: 13,
    fontStyle: 'italic',
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
  },
  officesSection: {
    marginBottom: 24,
  },
  officesHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  officeCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  officeAddress: {},
  officePhone: {
    marginTop: 4,
  },
  cascade: {
    gap: 12,
  },
})
