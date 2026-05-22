'use client'

import { useMemo, useState } from 'react'
import {
  useOfficialSponsoredBills,
  useOfficialCosponsoredBills,
  useOfficialMissedVotes,
} from '@chiaro/bills'
import { useOfficialMetrics } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalSponsoredBillsList } from './FederalSponsoredBillsList'
import { FederalCosponsoredBillsList } from './FederalCosponsoredBillsList'
import { FederalMissedVotesList } from './FederalMissedVotesList'

interface Props {
  officialId: string
  congress: string  // e.g. '119'
}

export function FederalVotingBillsCard({ officialId, congress }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const sponsored = useOfficialSponsoredBills(client, officialId, congress)
  const cosponsored = useOfficialCosponsoredBills(client, officialId, congress)
  const missed = useOfficialMissedVotes(client, officialId, congress)

  const [openSponsored, setOpenSponsored] = useState(false)
  const [openCosponsored, setOpenCosponsored] = useState(false)
  const [openMissed, setOpenMissed] = useState(false)

  if (sponsored.isLoading || cosponsored.isLoading || missed.isLoading || metrics.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
        <div style={mutedStyle}>Loading voting & bills…</div>
      </section>
    )
  }

  const sponsoredCount = sponsored.data?.length ?? 0
  const cosponsoredCount = cosponsored.data?.length ?? 0
  const missedCount = missed.data?.length ?? 0
  const attendance = metrics.data?.attendance_pct ?? null

  const allEmpty = sponsoredCount === 0 && cosponsoredCount === 0 && missedCount === 0
  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No bill or voting-record data on file for this Congress.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Voting & Bills ({congress}th Congress)</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {`${sponsoredCount} sponsored`} ·{' '}
        {`${cosponsoredCount} cosponsored`} ·{' '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </div>

      <Subsection label={`Sponsored bills (${sponsoredCount})`}
                  open={openSponsored} onToggle={() => setOpenSponsored(v => !v)}>
        <FederalSponsoredBillsList rows={sponsored.data ?? []} />
      </Subsection>

      <Subsection label={`Cosponsored bills (${cosponsoredCount})`}
                  open={openCosponsored} onToggle={() => setOpenCosponsored(v => !v)}>
        <FederalCosponsoredBillsList rows={cosponsored.data ?? []} />
      </Subsection>

      <Subsection label={`Missed votes (${missedCount})`}
                  open={openMissed} onToggle={() => setOpenMissed(v => !v)}>
        <FederalMissedVotesList rows={missed.data ?? []} />
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
