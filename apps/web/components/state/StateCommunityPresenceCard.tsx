'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateTownHalls,
  useOfficialStateDistrictOffices,
  useOfficialStateCommitteeHearings,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateTownHallsList } from './StateTownHallsList'
import { StateCommitteeHearingsList } from './StateCommitteeHearingsList'
import { StateDistrictOfficesList } from './StateDistrictOfficesList'

interface Props { officialId: string }

export function StateCommunityPresenceCard({ officialId }: Props): React.JSX.Element {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const halls    = useOfficialStateTownHalls(client, officialId)
  const offices  = useOfficialStateDistrictOffices(client, officialId)
  const hearings = useOfficialStateCommitteeHearings(client, officialId)

  const [openHalls, setOpenHalls]       = useState(false)
  const [openHearings, setOpenHearings] = useState(false)
  const [openOffices, setOpenOffices]   = useState(false)

  if (halls.isLoading || offices.isLoading || hearings.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={mutedStyle}>Loading community presence…</div>
      </section>
    )
  }

  const allEmpty =
    (halls.data ?? []).length === 0 &&
    (offices.data ?? []).length === 0 &&
    (hearings.data ?? []).length === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No community-presence data available for this legislator yet.
        </div>
      </section>
    )
  }

  // Header counts: per [[feedback-null-vs-zero-metrics]], em-dash when the
  // count is unknown (data === undefined), numeric (including 0) when known.
  const hallCount    = halls.data?.length    ?? null
  const officeCount  = offices.data?.length  ?? null
  const hearingCount = hearings.data?.length ?? null

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Community Presence</h2>

      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {hallCount    != null ? `${hallCount} town hall${hallCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {hearingCount != null ? `${hearingCount} hearing${hearingCount === 1 ? '' : 's'} attended` : '—'} ·{' '}
        {officeCount  != null ? `${officeCount} office${officeCount === 1 ? '' : 's'}` : '—'}
      </div>

      <Subsection
        label={`Town halls (${hallCount ?? '—'})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings(v => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </Subsection>

      <Subsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
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
