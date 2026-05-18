import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { PillChevron } from '@/components/cards/PillChevron'

export interface TopAmountRow {
  label: string
  amount: number
}

export interface TopAmountNoun {
  singular: string
  plural: string
}

export interface TopAmountBreakdownProps {
  rows: ReadonlyArray<TopAmountRow>
  noun: TopAmountNoun
  sourceUrl?: string
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function TopAmountBreakdown({ rows, noun, sourceUrl }: TopAmountBreakdownProps) {
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <View
      style={{
        backgroundColor: '#f4faf6', borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6,
        padding: 14,
      }}
    >
      <View style={{ gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0
          return (
            <View key={r.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontWeight: isTop ? '700' : '600', fontSize: isTop ? 14 : 13, color: '#1a1714' }}>
                  {r.label}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{ fontWeight: '700', color: '#1a1714' }}>{formatMoney(r.amount)}</Text>
                  <Text style={{ color: '#5a5751', fontSize: 11 }}> · {pct}%</Text>
                </View>
              </View>
              <View style={{ marginTop: 4, height: 6, backgroundColor: '#e8e6dd', borderRadius: 3 }}>
                <View style={{ backgroundColor: '#3da75b', width: `${(r.amount / max) * 100}%`, height: '100%', borderRadius: 3 }} />
              </View>
            </View>
          )
        })}
      </View>
      {showToggle ? (
        <Pressable
          onPress={() => setExpanded(v => !v)}
          style={{
            marginTop: 12,
            backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6,
            paddingHorizontal: 12, paddingVertical: 8,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}
        >
          <PillChevron open={expanded} />
          <Text style={{ flex: 1, fontWeight: '600', color: '#1a1714', fontSize: 13 }}>
            {expanded ? 'Show less' : `Show 5 more ${noun.plural}`}
          </Text>
          <Text style={{ color: '#5a5751', fontSize: 11 }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </Text>
        </Pressable>
      ) : null}
      {sourceUrl ? (
        <Pressable onPress={() => Linking.openURL(sourceUrl).catch(() => {})}>
          <Text style={{ marginTop: 12, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            → full breakdown on OpenSecrets
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
