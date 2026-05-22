import { useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useOfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { FederalDonorsList } from './FederalDonorsList'
import { FederalPACsList } from './FederalPACsList'

interface Props {
  officialId: string
  cycle: string // e.g. '2024'
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalFinanceCard({ officialId, cycle }: Props) {
  const finance = useOfficialFinance(supabase, officialId, cycle)

  const [openDonors, setOpenDonors] = useState(false)
  const [openPACs, setOpenPACs] = useState(false)

  if (finance.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Finance ({cycle})</Text>
        <Text style={styles.muted}>Loading finance…</Text>
      </View>
    )
  }

  const f = finance.data ?? null
  if (!f) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Finance ({cycle})</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No finance data available for this legislator and cycle.
        </Text>
      </View>
    )
  }

  const totalRaised = f.summary?.total_raised == null ? null : Number(f.summary.total_raised)
  const donorCount = f.individualDonors.length
  const pacCount = f.pacs.length

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Finance ({cycle})</Text>
      <Text style={styles.summary}>
        {fmtAmount(totalRaised)} raised
        {' · '}
        {`${donorCount} donor${donorCount === 1 ? '' : 's'}`}
        {' · '}
        {`${pacCount} PAC${pacCount === 1 ? '' : 's'}`}
      </Text>

      <Subsection
        label={`Top individual donors (${donorCount})`}
        open={openDonors}
        onToggle={() => setOpenDonors(v => !v)}
      >
        <FederalDonorsList finance={f} />
      </Subsection>

      <Subsection
        label={`Top PACs (${pacCount})`}
        open={openPACs}
        onToggle={() => setOpenPACs(v => !v)}
      >
        <FederalPACsList finance={f} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open && <View>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.background,
    borderColor: COLORS.neutral.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '600',
    marginBottom: 12, color: COLORS.brand.text,
  },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
  subsection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
    paddingTop: 8,
    marginTop: 8,
  },
  subsectionLabel: {
    color: COLORS.brand.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
