'use client'

import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useBrandTokens, useCategoryAccent, useCategoryCardBg } from '../brand-hooks.ts'
import { PillChevron } from '../cards/PillChevron.tsx'
import { SmartAnchor } from '../primitives/SmartAnchor.tsx'

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

export function TopAmountBreakdown({
  rows,
  noun,
  sourceUrl,
}: TopAmountBreakdownProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const cardBg = useCategoryCardBg()
  const financeAccent = useCategoryAccent('finance')
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map((r) => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: financeAccent,
        borderRadius: 6,
        padding: 14,
      }}
    >
      <View style={{ gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0
          return (
            <View key={r.label}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Text
                  style={{
                    fontWeight: isTop ? '700' : '600',
                    fontSize: isTop ? 14 : 13,
                    color: semantic.text.primary,
                  }}
                >
                  {r.label}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{ fontWeight: '700', color: semantic.text.primary }}>
                    {formatMoney(r.amount)}
                  </Text>
                  <Text style={{ color: semantic.text.muted, fontSize: 11 }}> · {pct}%</Text>
                </View>
              </View>
              <View
                style={{
                  marginTop: 4,
                  height: 6,
                  backgroundColor: semantic.border.default,
                  borderRadius: 3,
                }}
              >
                <View
                  style={{
                    backgroundColor: semantic.signal.success,
                    width: `${(r.amount / max) * 100}%`,
                    height: '100%',
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          )
        })}
      </View>
      {showToggle ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} top ${noun.plural}`}
          style={{
            marginTop: 12,
            backgroundColor: semantic.bg.elevated,
            borderWidth: 1,
            borderColor: semantic.border.default,
            borderRadius: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <PillChevron open={expanded} />
          <Text style={{ flex: 1, fontWeight: '600', color: semantic.text.primary, fontSize: 13 }}>
            {expanded ? 'Show less' : `Show 5 more ${noun.plural}`}
          </Text>
          <Text style={{ color: semantic.text.muted, fontSize: 11 }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </Text>
        </Pressable>
      ) : null}
      {sourceUrl ? (
        <SmartAnchor
          href={sourceUrl}
          style={{
            marginTop: 12,
            fontSize: 12,
            color: semantic.link.fg,
            textDecoration: 'underline',
            cursor: 'pointer',
            display: 'inline-block',
          }}
        >
          <Text style={{ fontSize: 12, color: semantic.link.fg, textDecorationLine: 'underline' }}>
            → full breakdown on OpenSecrets
          </Text>
        </SmartAnchor>
      ) : null}
    </View>
  )
}
