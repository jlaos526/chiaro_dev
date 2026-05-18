import { useState } from 'react'
import { View, Text, Modal, ScrollView, Pressable, Linking } from 'react-native'
import { useOfficialMetrics } from '@chiaro/officials'
import { useOfficialMissedVotes, useOfficialSponsoredBills } from '@chiaro/bills'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from './MetricCardShell'

type VoteRow = Database['public']['Tables']['votes']['Row']
type BillRow = Database['public']['Tables']['bills']['Row']
type MissedVoteRow = { vote_id: string; position: string; vote: VoteRow }

type DrillKey = 'missed' | 'sponsored'

export function ShowUpWorkloadCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(supabase, officialId)
  const [open, setOpen] = useState<DrillKey | null>(null)
  const missed = useOfficialMissedVotes(supabase, officialId, '119', { enabled: open === 'missed' })
  const sponsored = useOfficialSponsoredBills(supabase, officialId, '119', { enabled: open === 'sponsored' })

  if (m.isLoading) return <Text>Loading…</Text>
  if (!m.data) {
    return (
      <MetricCardShell
        title="Show-up & workload"
        value="—"
        caption="No metrics yet — run pnpm recompute:metrics"
        externalSourceUrl="https://www.congress.gov/"
      />
    )
  }

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Show-up & workload</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ width: '48%' }}>
          <MetricCardShell
            title="Attendance"
            value={m.data.attendance_pct !== null ? `${m.data.attendance_pct}%` : '—'}
            caption={`${m.data.votes_voted_count ?? 0}/${m.data.total_roll_calls ?? 0} roll calls`}
            onExpand={() => setOpen('missed')}
          />
        </View>
        <View style={{ width: '48%' }}>
          <MetricCardShell
            title="Bills sponsored"
            value={m.data.bills_sponsored_count ?? '—'}
            caption={`Career: ${m.data.career_bills_sponsored_count ?? '—'}`}
            onExpand={() => setOpen('sponsored')}
          />
        </View>
        <View style={{ width: '48%' }}>
          <MetricCardShell
            title="Bills cosponsored"
            value={m.data.bills_cosponsored_count ?? '—'}
            externalSourceUrl="https://www.congress.gov/member/"
          />
        </View>
        <View style={{ width: '48%' }}>
          <MetricCardShell
            title="Committees"
            value={m.data.committee_assignment_count ?? '—'}
            caption={
              m.data.committee_leadership_count
                ? `${m.data.committee_leadership_count} leadership`
                : 'data coming slice 5'
            }
            externalSourceUrl="https://www.congress.gov/committees"
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
          {open === 'missed' && renderMissed(missed.data, missed.isLoading)}
          {open === 'sponsored' && renderSponsored(sponsored.data, sponsored.isLoading)}
        </ScrollView>
      </Modal>
    </View>
  )
}

function drillTitle(k: DrillKey | null): string {
  if (k === 'missed') return 'Missed votes'
  if (k === 'sponsored') return 'Sponsored bills'
  return ''
}

function renderMissed(data: MissedVoteRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) return <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>None.</Text>
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((row) => (
        <Pressable
          key={row.vote_id}
          onPress={() => Linking.openURL(row.vote.source_url)}
          style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: COLORS.neutral.border }}
        >
          <Text style={{ color: COLORS.brand.primary }}>
            {row.vote.vote_date} · {row.vote.question}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function renderSponsored(data: BillRow[] | undefined, loading: boolean) {
  if (loading) return <Text>Loading…</Text>
  const rows = data ?? []
  if (rows.length === 0) return <Text style={{ color: COLORS.neutral.mute, marginTop: 8 }}>None this Congress.</Text>
  return (
    <View style={{ marginTop: 8 }}>
      {rows.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => Linking.openURL(b.source_url)}
          style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: COLORS.neutral.border }}
        >
          <Text style={{ color: COLORS.brand.primary }}>
            {b.bill_type.toUpperCase()} {b.number}: {b.title}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
