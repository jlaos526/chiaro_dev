import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

const INITIAL_ROW_COUNT = 5

function fmtAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function secondaryLine(d: StateFinanceIndividualDonorRow): string | null {
  const parts: string[] = []
  if (d.employer) parts.push(d.employer)
  if (d.occupation) parts.push(d.occupation)
  if (d.city) {
    parts.push(d.donor_state ? `${d.city}, ${d.donor_state}` : d.city)
  } else if (d.donor_state) {
    parts.push(d.donor_state)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function StateDonorsEvidence({ donors }: { donors: StateFinanceIndividualDonorRow[] }) {
  const [expanded, setExpanded] = useState(false)
  if (donors.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No donor data for this cycle.
        </Text>
      </View>
    )
  }
  const visible = expanded ? donors : donors.slice(0, INITIAL_ROW_COUNT)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-donors-evidence">
      {visible.map(d => {
        const secondary = secondaryLine(d)
        return (
          <View
            key={d.rank}
            style={{
              padding: 8,
              borderTopWidth: 1,
              borderTopColor: COLORS.neutral.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontWeight: '600', color: COLORS.brand.text }}>{d.donor_name}</Text>
              <Text style={{ color: COLORS.brand.text }}>{fmtAmount(Number(d.amount))}</Text>
            </View>
            {secondary && (
              <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                {secondary}
              </Text>
            )}
          </View>
        )
      })}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          style={{
            marginTop: 8,
            paddingVertical: 4,
            paddingHorizontal: 10,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: COLORS.neutral.border,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.brand.text }}>
            {expanded ? 'show less' : `show more (${donors.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
