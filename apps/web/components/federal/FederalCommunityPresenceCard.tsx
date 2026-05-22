'use client'

import { useMemo, useState } from 'react'
import {
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalTownHallsList } from './FederalTownHallsList'
import { FederalDistrictOfficesList } from './FederalDistrictOfficesList'

interface Props {
  officialId: string
  congress: string   // e.g. '119'
}

export function FederalCommunityPresenceCard({ officialId, congress }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const offices = useOfficialDistrictOffices(client, officialId)
  const halls = useOfficialTownHalls(client, officialId, congress)

  const [openHalls, setOpenHalls] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  if (offices.isLoading || halls.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={mutedStyle}>Loading community presence…</div>
      </section>
    )
  }

  const hallsCount = halls.data?.length ?? 0
  // Federal `district_offices` lacks `kind` column — count all rows uniformly.
  const officesCount = offices.data?.length ?? 0
  const allEmpty = hallsCount === 0 && officesCount === 0

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

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Community Presence</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {`${hallsCount} town hall${hallsCount === 1 ? '' : 's'}`} ·{' '}
        {`${officesCount} office${officesCount === 1 ? '' : 's'}`}
      </div>

      <Subsection label={`Town halls (${hallsCount})`}
                  open={openHalls} onToggle={() => setOpenHalls(v => !v)}>
        <FederalTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection label={`District offices (${officesCount})`}
                  open={openOffices} onToggle={() => setOpenOffices(v => !v)}>
        <FederalDistrictOfficesList rows={offices.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8, marginTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
