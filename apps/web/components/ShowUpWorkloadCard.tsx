'use client'
import { useState } from 'react'
import { useOfficialMetrics } from '@chiaro/officials'
import { useOfficialMissedVotes, useOfficialSponsoredBills } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MetricCardShell } from './MetricCardShell'

const client = createSupabaseBrowserClient()

export function ShowUpWorkloadCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(client, officialId)
  const [open, setOpen] = useState<'missed' | 'sponsored' | null>(null)
  const missed = useOfficialMissedVotes(client, officialId, '119', { enabled: open === 'missed' })
  const sponsored = useOfficialSponsoredBills(client, officialId, '119', { enabled: open === 'sponsored' })

  if (m.isLoading) return <p>Loading…</p>
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
    <section>
      <h3 style={{ margin: '0 0 8px' }}>Show-up & workload</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricCardShell
          title="Attendance"
          value={m.data.attendance_pct !== null ? `${m.data.attendance_pct}%` : '—'}
          caption={`${m.data.votes_voted_count}/${m.data.total_roll_calls} roll calls`}
          onExpand={() => setOpen('missed')}
        />
        <MetricCardShell
          title="Bills sponsored"
          value={m.data.bills_sponsored_count ?? '—'}
          caption={`Career: ${m.data.career_bills_sponsored_count ?? '—'}`}
          onExpand={() => setOpen('sponsored')}
        />
        <MetricCardShell
          title="Bills cosponsored"
          value={m.data.bills_cosponsored_count ?? '—'}
          externalSourceUrl="https://www.congress.gov/member/"
        />
        <MetricCardShell
          title="Committees"
          value={m.data.committee_assignment_count ?? '—'}
          caption={m.data.committee_leadership_count ? `${m.data.committee_leadership_count} leadership` : 'data coming slice 5'}
          externalSourceUrl="https://www.congress.gov/committees"
        />
      </div>

      {/* drill-down overlays */}
      {open === 'missed' && (
        <DrillOverlay title="Missed votes" onClose={() => setOpen(null)}>
          {missed.isLoading ? <p>Loading…</p> : (
            <ul>
              {(missed.data ?? []).map(row => (
                <li key={row.vote_id}>
                  <a href={row.vote.source_url} target="_blank" rel="noreferrer">
                    {row.vote.vote_date} · {row.vote.question}
                  </a>
                </li>
              ))}
              {(missed.data ?? []).length === 0 && <li>None.</li>}
            </ul>
          )}
        </DrillOverlay>
      )}
      {open === 'sponsored' && (
        <DrillOverlay title="Sponsored bills" onClose={() => setOpen(null)}>
          {sponsored.isLoading ? <p>Loading…</p> : (
            <ul>
              {(sponsored.data ?? []).map(b => (
                <li key={b.id}>
                  <a href={b.source_url} target="_blank" rel="noreferrer">
                    {b.bill_type.toUpperCase()} {b.number}: {b.title}
                  </a>
                </li>
              ))}
              {(sponsored.data ?? []).length === 0 && <li>None this Congress.</li>}
            </ul>
          )}
        </DrillOverlay>
      )}
    </section>
  )
}

function DrillOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}>
      <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 12, maxHeight: '80vh', overflow: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>{title}</h3>
          <button onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>
  )
}
