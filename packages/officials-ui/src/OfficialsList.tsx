import { createElement } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import {
  isStateLevel,
  useMyOfficials,
  type OfficialWithDistrict,
  type Party,
} from '@chiaro/officials'
import { useBrandTokens } from './brand-hooks.ts'
import { OfficialAvatar } from './OfficialAvatar.tsx'
import { PartyBadge } from './PartyBadge.tsx'
import { OfficialMeta } from './OfficialMeta.tsx'
import { useChiaroClient } from './client-context.tsx'

/** Slice 79.5 (audit U4): rows carry their tier so consumers can route
 * federal rows to `/officials/[id]` and state rows to `/state-officials/[id]`. */
export interface OfficialsListTarget {
  officialId: string
  level: 'federal' | 'state'
}

export interface OfficialsListProps {
  /** Invoked when an official row is tapped. Consumers wire router
   * navigation (`/officials/[id]` or `/state-officials/[id]` by level) here. */
  onSelect: (target: OfficialsListTarget) => void
  /** Invoked when the calibrate prompt (shown when user has no officials) is tapped. */
  onCalibrate: () => void
  /** Optional URL builder for the per-row link href (web a11y restoration;
   * native ignored). When provided, official rows render real `<a href>`
   * on web with plain left-click intercepted to `onSelect`. */
  getHref?: (target: OfficialsListTarget) => string
  /** Optional URL for the calibrate prompt (web a11y restoration; native ignored). */
  calibrateHref?: string
}

function Section({
  title,
  items,
  onSelect,
  getHref,
}: {
  title: string
  items: OfficialWithDistrict[]
  onSelect: (target: OfficialsListTarget) => void
  getHref?: (target: OfficialsListTarget) => string
}): React.JSX.Element | null {
  const { semantic } = useBrandTokens()
  if (items.length === 0) return null
  return (
    <View accessibilityLabel={title} style={{ marginBottom: 24 }}>
      <Text
        style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: semantic.text.primary }}
      >
        {title}
      </Text>
      <View style={{ gap: 12 }}>
        {items.map((o) => {
          const level = isStateLevel(o.chamber) ? ('state' as const) : ('federal' as const)
          const handlePress = () => onSelect({ officialId: o.id, level })
          const href = getHref?.({ officialId: o.id, level })

          const inner = (
            <>
              <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: semantic.text.primary }}>
                  {o.full_name}
                </Text>
                <PartyBadge party={o.party as Party} />
                <OfficialMeta official={o} />
              </View>
            </>
          )

          // Web smart-anchor case: real <a href> with intercepted plain left-click.
          if (Platform.OS === 'web' && href) {
            return createElement(
              'a',
              {
                key: o.id,
                href,
                onClick: (e: MouseEvent) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                  e.preventDefault()
                  handlePress()
                },
                'aria-label': `View ${o.full_name}`,
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                },
              },
              inner,
            )
          }

          return (
            <Pressable
              key={o.id}
              onPress={handlePress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
              accessibilityRole="link"
              accessibilityLabel={`View ${o.full_name}`}
            >
              {inner}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function OfficialsList({
  onSelect,
  onCalibrate,
  getHref,
  calibrateHref,
}: OfficialsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const { data, isLoading, error, refetch } = useMyOfficials(client)

  if (isLoading) return <Text style={{ color: semantic.text.muted }}>Loading…</Text>
  if (error) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: semantic.text.muted }}>Couldn&apos;t load officials.</Text>
        <Pressable
          onPress={() => {
            void refetch()
          }}
          accessibilityRole="button"
        >
          <Text style={{ color: semantic.accent.primary, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    )
  }
  if (!data || data.length === 0) {
    const calibrateContent = (
      <Text style={{ color: semantic.accent.primary }}>
        Calibrate your address to see your delegation.
      </Text>
    )

    // Web smart-anchor case for calibrate prompt.
    if (Platform.OS === 'web' && calibrateHref) {
      return createElement(
        'a',
        {
          href: calibrateHref,
          onClick: (e: MouseEvent) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
            e.preventDefault()
            onCalibrate()
          },
          style: {
            textDecoration: 'none',
            cursor: 'pointer',
            display: 'inline-block',
          },
        },
        calibrateContent,
      )
    }

    return (
      <Pressable onPress={onCalibrate} accessibilityRole="link">
        {calibrateContent}
      </Pressable>
    )
  }

  const senate = data.filter((o) => o.chamber === 'federal_senate')
  const house = data.filter((o) => o.chamber === 'federal_house')
  // Slice 79.5 (audit U4): state legislators were silently dropped — the
  // page rendered federal-only while useMyOfficials returned both tiers.
  const stateSenate = data.filter((o) => o.chamber === 'state_senate')
  const stateHouse = data.filter((o) => o.chamber === 'state_house')
  // NE unicameral (chamber state_legislature) — its own section label.
  const stateLegislature = data.filter((o) => o.chamber === 'state_legislature')

  return (
    <View>
      <Section
        title="Senate"
        items={senate}
        onSelect={onSelect}
        {...(getHref ? { getHref } : {})}
      />
      <Section title="House" items={house} onSelect={onSelect} {...(getHref ? { getHref } : {})} />
      <Section
        title="State Senate"
        items={stateSenate}
        onSelect={onSelect}
        {...(getHref ? { getHref } : {})}
      />
      <Section
        title="State House"
        items={stateHouse}
        onSelect={onSelect}
        {...(getHref ? { getHref } : {})}
      />
      <Section
        title="State Legislature"
        items={stateLegislature}
        onSelect={onSelect}
        {...(getHref ? { getHref } : {})}
      />
    </View>
  )
}
