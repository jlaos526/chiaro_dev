import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'ethics-accountability'
void CATEGORY
const ACCENT = '#d68a1f'
const LINK = '#3b6ed1'
const OPEN_SECRETS_URL = 'https://www.opensecrets.org/'

function formatRange(low: number | null, high: number | null): string {
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`)
  if (low == null || high == null) return '—'
  return `${fmt(low)}–${fmt(high)}`
}

export function EthicsAccountabilityCategory({
  officialId,
}: {
  officialId: string
}): React.JSX.Element {
  const metrics = useOfficialMetrics(supabase, officialId)
  const [stockOpen, setStockOpen] = useState(false)
  const stock = useOfficialStockTransactions(supabase, officialId, { enabled: stockOpen })

  if (metrics.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
  const m = metrics.data

  const data = stock.data ?? []
  const worstCase = data.reduce((max, t) => Math.max(max, t.days_late ?? 0), 0)
  const volumeLow = data.reduce((s, t) => s + (t.amount_range_low ?? 0), 0)
  const volumeHigh = data.reduce((s, t) => s + (t.amount_range_high ?? 0), 0)

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }}>
      <View
        style={{
          width: '48%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#fcf7f0',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {m?.stock_act_compliance_pct != null ? `${m.stock_act_compliance_pct}%` : '—'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>STOCK Act Compliance</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#807a72', marginTop: 2 }}>
          {m?.stock_act_disclosures_late ?? 0} late / {m?.stock_act_disclosures_total ?? 0} total
          {data.length > 0 && worstCase > 0 ? ` · worst: ${worstCase} days` : ''}
        </Text>
        {data.length > 0 ? (
          <Text style={{ fontSize: 11, color: '#807a72' }}>
            Total disclosed volume: {formatRange(volumeLow, volumeHigh)}
          </Text>
        ) : null}
        <EvidenceExpand
          title="Transactions"
          open={stockOpen}
          onToggle={() => setStockOpen((v) => !v)}
        >
          {stock.isLoading ? (
            <Text style={{ fontSize: 13, color: '#5a5751' }}>Loading…</Text>
          ) : data.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#807a72' }}>
              No STOCK Act disclosures filed.
            </Text>
          ) : (
            <View>
              {data.map((t, i) => {
                const late = (t.days_late ?? 0) > 0
                return (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: '#f0eee5',
                    }}
                  >
                    <ComplianceIcon state={late ? 'late' : 'on-time'} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, color: '#1a1714', fontWeight: '700', flexShrink: 1 }}>
                          {t.asset_ticker ?? t.asset_name ?? '?'}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#1a1714', fontWeight: '600' }}>
                          {formatRange(t.amount_range_low, t.amount_range_high)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#5a5751', marginTop: 3 }}>
                        {t.transaction_type ?? '?'} · filed {t.filing_date}
                        {late ? (
                          <Text style={{ fontWeight: '700' }}> · {t.days_late} days late</Text>
                        ) : null}
                      </Text>
                      <Pressable
                        onPress={() => Linking.openURL(t.source_url).catch(() => {})}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: LINK,
                            textDecorationLine: 'underline',
                            marginTop: 3,
                          }}
                        >
                          → source
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </EvidenceExpand>
      </View>

      <View
        style={{
          width: '48%',
          borderWidth: 1,
          borderColor: '#d8d4c9',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#fcf7f0',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1714', lineHeight: 24 }}>
          {m?.in_state_donations_pct != null ? `${m.in_state_donations_pct}%` : '—'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginRight: 6 }}
          />
          <Text style={{ fontSize: 13, color: '#1a1714' }}>In-State Donors</Text>
        </View>
        {m?.out_of_state_donations_pct != null ? (
          <Text style={{ fontSize: 11, color: '#807a72', marginTop: 2 }}>
            {m.out_of_state_donations_pct}% out-of-state
          </Text>
        ) : null}
        <Pressable
          onPress={() => Linking.openURL(OPEN_SECRETS_URL).catch(() => {})}
          style={{ marginTop: 10 }}
        >
          <Text style={{ fontSize: 12, color: LINK, textDecorationLine: 'underline' }}>
            view source →
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
