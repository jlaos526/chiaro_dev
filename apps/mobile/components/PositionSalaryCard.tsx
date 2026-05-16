import { useState } from 'react'
import { View, Text, Modal, ScrollView, Pressable, Linking } from 'react-native'
import { useOfficialMetrics, useOfficialLeadershipHistory } from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from './MetricCardShell'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

export function PositionSalaryCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(supabase, officialId)
  const [open, setOpen] = useState(false)
  const lead = useOfficialLeadershipHistory(supabase, officialId, { enabled: open })

  if (m.isLoading) return <Text>Loading…</Text>
  if (!m.data) return null

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
        Position, salary & leadership
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="Base salary"
            value={m.data.salary_usd ? `$${m.data.salary_usd.toLocaleString()}` : '—'}
            caption={m.data.salary_role ?? ''}
            externalSourceUrl="https://crsreports.congress.gov/product/pdf/R/R44648"
          />
        </View>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="Tenure"
            value={m.data.tenure_years ? `${m.data.tenure_years} yrs` : '—'}
            onExpand={() => setOpen(true)}
          />
        </View>
        <View style={{ flex: 1, minWidth: '30%' }}>
          <MetricCardShell
            title="Leadership role"
            value={
              m.data.salary_role && m.data.salary_role !== 'Member'
                ? m.data.salary_role
                : 'Member'
            }
            onExpand={() => setOpen(true)}
          />
        </View>
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Pressable onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ fontSize: 18 }}>×</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Leadership history</Text>
          {renderLeadership(lead.data, lead.isLoading)}
        </ScrollView>
      </Modal>
    </View>
  )
}

function renderLeadership(data: LeadershipRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>
        No leadership history ingested.
      </Text>
    )
  }
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((r) => (
        <View
          key={r.id}
          style={{
            paddingVertical: 8,
            borderTopWidth: 1,
            borderColor: COLORS.neutral.border,
          }}
        >
          <Text>
            <Text style={{ fontWeight: '700' }}>{r.role}</Text>
            {' · '}
            {r.start_date} – {r.end_date ?? 'present'}
          </Text>
          <Pressable onPress={() => Linking.openURL(r.source_url)}>
            <Text style={{ color: COLORS.brand.primary, fontSize: 13, marginTop: 2 }}>
              → source
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}
