'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateEthicsComplaints,
  useOfficialStateOfficialEvents,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateEthicsComplaintsList } from './StateEthicsComplaintsList'
import { StateOfficialEventsList } from './StateOfficialEventsList'

interface Props { officialId: string }

export function StateConductCard({ officialId }: Props): React.JSX.Element {
  const client     = useMemo(() => createSupabaseBrowserClient(), [])
  const complaints = useOfficialStateEthicsComplaints(client, officialId)
  const events     = useOfficialStateOfficialEvents(client, officialId)

  const [openComplaints, setOpenComplaints] = useState(false)
  const [openEvents,     setOpenEvents]     = useState(false)

  if (complaints.isLoading || events.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Conduct & Sanctions</h2>
        <div style={mutedStyle}>Loading conduct records…</div>
      </section>
    )
  }

  // Header counts: per [[feedback-null-vs-zero-metrics]], em-dash when unknown,
  // numeric (incl. 0) when known.
  const complaintCount = complaints.data?.length ?? null
  const openCount      = complaints.data?.filter(r => r.status === 'open').length ?? 0
  const eventCount     = events.data?.length ?? null
  const allEmpty       = complaintCount === 0 && eventCount === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Conduct & Sanctions</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No ethics complaints or conduct events on record for this legislator.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Conduct & Sanctions</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {complaintCount != null ? `${complaintCount} complaint${complaintCount === 1 ? '' : 's'} (${openCount} open)` : '—'} ·{' '}
        {eventCount     != null ? `${eventCount} event${eventCount === 1 ? '' : 's'}` : '—'}
      </div>

      <Subsection
        label={`Ethics complaints (${complaintCount ?? '—'})`}
        open={openComplaints}
        onToggle={() => setOpenComplaints(v => !v)}
      >
        <StateEthicsComplaintsList rows={complaints.data ?? []} />
      </Subsection>

      <Subsection
        label={`Sanctions / recall / resignation (${eventCount ?? '—'})`}
        open={openEvents}
        onToggle={() => setOpenEvents(v => !v)}
      >
        <StateOfficialEventsList rows={events.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
          textAlign: 'left',
          cursor: 'pointer',
          color: COLORS.brand.text,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 12,
  marginTop: 0,
  color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted,
  fontSize: 13,
}
