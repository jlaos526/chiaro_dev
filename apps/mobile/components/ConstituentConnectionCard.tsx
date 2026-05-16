import { useState } from 'react'
import { View, Text, Modal, ScrollView, Pressable, Linking } from 'react-native'
import {
  useOfficialMetrics,
  useOfficialDistrictOffices,
  useOfficialTownHalls,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from './MetricCardShell'

type DistrictOfficeRow = Database['public']['Tables']['district_offices']['Row']
type TownHallRow = Database['public']['Tables']['town_halls']['Row']
type StockTransactionRow = Database['public']['Tables']['stock_transactions']['Row']

type DrillKey = 'offices' | 'town-halls' | 'stock'

export function ConstituentConnectionCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(supabase, officialId)
  const [open, setOpen] = useState<DrillKey | null>(null)
  const offices = useOfficialDistrictOffices(supabase, officialId, { enabled: open === 'offices' })
  const halls = useOfficialTownHalls(supabase, officialId, '119', { enabled: open === 'town-halls' })
  const stock = useOfficialStockTransactions(supabase, officialId, { enabled: open === 'stock' })

  if (m.isLoading) return <Text>Loading…</Text>
  if (!m.data) return null

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
        Constituent connection
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="Lives in district"
            value={
              m.data.lives_in_district === null
                ? 'N/A (Senate)'
                : m.data.lives_in_district
                  ? '✓ Yes'
                  : '✗ No'
            }
            caption={
              m.data.home_district_id
                ? 'home maps to a district'
                : 'address outside represented district'
            }
            externalSourceUrl="https://www.fec.gov/data/"
          />
        </View>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="District offices"
            value={m.data.district_offices_count ?? 0}
            onExpand={() => setOpen('offices')}
          />
        </View>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="Town halls (119th)"
            value={m.data.town_halls_count ?? 0}
            onExpand={() => setOpen('town-halls')}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <MetricCardShell
            title="STOCK Act compliance"
            value={
              m.data.stock_act_compliance_pct !== null
                ? `${m.data.stock_act_compliance_pct}%`
                : '—'
            }
            caption={`${m.data.stock_act_disclosures_late ?? 0} late / ${m.data.stock_act_disclosures_total ?? 0} total`}
            onExpand={() => setOpen('stock')}
          />
        </View>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <MetricCardShell
            title="In-state donors"
            value={
              m.data.in_state_donations_pct !== null
                ? `${m.data.in_state_donations_pct}%`
                : '—'
            }
            caption={
              m.data.out_of_state_donations_pct !== null
                ? `${m.data.out_of_state_donations_pct}% out-of-state`
                : ''
            }
            externalSourceUrl="https://www.opensecrets.org/"
          />
        </View>
      </View>

      <Modal
        visible={open !== null}
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Pressable onPress={() => setOpen(null)} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ fontSize: 18 }}>×</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{drillTitle(open)}</Text>
          {open === 'offices' && renderOffices(offices.data, offices.isLoading)}
          {open === 'town-halls' && renderHalls(halls.data, halls.isLoading)}
          {open === 'stock' && renderStock(stock.data, stock.isLoading)}
        </ScrollView>
      </Modal>
    </View>
  )
}

function drillTitle(k: DrillKey | null): string {
  if (k === 'offices') return 'District offices'
  if (k === 'town-halls') return 'Town halls'
  if (k === 'stock') return 'STOCK Act transactions'
  return ''
}

function renderOffices(data: DistrictOfficeRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>
        No district offices listed.
      </Text>
    )
  }
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((o) => (
        <View
          key={o.id}
          style={{
            paddingVertical: 8,
            borderTopWidth: 1,
            borderColor: COLORS.neutral.border,
          }}
        >
          <Text style={{ fontWeight: '700' }}>
            {o.city}, {o.state}
          </Text>
          <Text>
            {o.address} {o.zip}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
            {o.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${o.phone}`)}>
                <Text style={{ color: COLORS.brand.primary }}>{o.phone}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => Linking.openURL(o.source_url)}>
              <Text style={{ color: COLORS.brand.primary, fontSize: 13 }}>→ source</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  )
}

function renderHalls(data: TownHallRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>
        No town halls in the 119th Congress.
      </Text>
    )
  }
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((h) => (
        <View
          key={h.id}
          style={{
            paddingVertical: 8,
            borderTopWidth: 1,
            borderColor: COLORS.neutral.border,
          }}
        >
          <Text>
            <Text style={{ fontWeight: '700' }}>{h.event_date}</Text>
            {' · '}
            {h.city ?? '?'}, {h.state ?? '?'} · {h.format ?? '?'}
          </Text>
          <Pressable onPress={() => Linking.openURL(h.source_url)}>
            <Text style={{ color: COLORS.brand.primary, fontSize: 13, marginTop: 2 }}>
              → Town Hall Project
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

function renderStock(data: StockTransactionRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>
        No STOCK Act disclosures filed.
      </Text>
    )
  }
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((t) => {
        const late = (t.days_late ?? 0) > 0
        const rowColor = late ? COLORS.signal.error : COLORS.brand.text
        return (
          <View
            key={t.id}
            style={{
              paddingVertical: 8,
              borderTopWidth: 1,
              borderColor: COLORS.neutral.border,
            }}
          >
            <Text style={{ color: rowColor }}>
              <Text style={{ fontWeight: '700' }}>{t.transaction_date}</Text>
              {' · '}
              {t.transaction_type ?? '?'} · {t.asset_ticker ?? t.asset_name ?? '?'}
              {' · filed '}
              {t.filing_date}
              {late ? ` (${t.days_late} days late)` : ''}
            </Text>
            <Pressable onPress={() => Linking.openURL(t.source_url)}>
              <Text style={{ color: COLORS.brand.primary, fontSize: 13, marginTop: 2 }}>
                → source
              </Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}
