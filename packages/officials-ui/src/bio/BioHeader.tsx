import { createElement } from 'react'
import { Platform, Text, View } from 'react-native'
import type { AlignmentChipRow } from '@chiaro/officials'
import { BioPortrait } from './BioPortrait.tsx'
import { BioIdentityRow } from './BioIdentityRow.tsx'
import { BioServiceCard } from './BioServiceCard.tsx'
import { BioContactLinks } from './BioContactLinks.tsx'
import { BioAlignmentChipRow } from './BioAlignmentChipRow.tsx'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'federal_house' | 'federal_senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
  /** Optional per-chip press handler. When omitted, alignment chips render
   * inert (no nav). Consumers wire router navigation here. */
  onChipPress?: (chip: AlignmentChipRow) => void
  /** Optional URL builder for chip href (web a11y restoration; native ignored). */
  chipHref?: (chip: AlignmentChipRow) => string
}

export function BioHeader(p: BioHeaderProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const innerContent = (
    <>
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <Text accessibilityRole="header" accessibilityLevel={1} style={{ fontSize: 24, fontWeight: '700', color: semantic.text.primary }}>{p.fullName}</Text>
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        stateAbbrev={p.state}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow
        chips={p.chips}
        {...(p.onChipPress ? { onChipPress: p.onChipPress } : {})}
        {...(p.chipHref ? { chipHref: p.chipHref } : {})}
      />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </>
  )

  // Slice 25: on web, render real <section aria-label="..."> for landmark-role a11y.
  // Slice 14 used outer <View> + accessibilityLabel which translated to
  // <div aria-label="..."> — no landmark role, screen readers couldn't navigate
  // by region. createElement escape hatch restores the landmark.
  // Native side keeps the original <View> path (no DOM; native a11y uses
  // accessibilityLabel directly).
  if (Platform.OS === 'web') {
    return createElement(
      'section',
      {
        'aria-label': `${p.fullName} bio`,
        style: {
          paddingTop: 24,
          paddingBottom: 24,
          paddingLeft: 16,
          paddingRight: 16,
          alignItems: 'center',
          gap: 12,
          display: 'flex',
          flexDirection: 'column',
        },
      },
      innerContent,
    )
  }

  return (
    <View
      accessibilityLabel={`${p.fullName} bio`}
      style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}
    >
      {innerContent}
    </View>
  )
}
