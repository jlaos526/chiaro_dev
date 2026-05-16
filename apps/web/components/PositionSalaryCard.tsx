'use client'
import { useState } from 'react'
import { useOfficialMetrics, useOfficialLeadershipHistory } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MetricCardShell } from './MetricCardShell'

const client = createSupabaseBrowserClient()

export function PositionSalaryCard({ officialId }: { officialId: string }) {
  const m = useOfficialMetrics(client, officialId)
  const [open, setOpen] = useState(false)
  const lead = useOfficialLeadershipHistory(client, officialId, { enabled: open })

  if (m.isLoading) return <p>Loading…</p>
  if (!m.data) return null

  return (
    <section>
      <h3 style={{ margin: '0 0 8px' }}>Position, salary & leadership</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <MetricCardShell
          title="Base salary"
          value={m.data.salary_usd ? `$${m.data.salary_usd.toLocaleString()}` : '—'}
          caption={m.data.salary_role ?? ''}
          externalSourceUrl="https://crsreports.congress.gov/product/pdf/R/R44648"
        />
        <MetricCardShell
          title="Tenure"
          value={m.data.tenure_years ? `${m.data.tenure_years} yrs` : '—'}
          onExpand={() => setOpen(true)}
        />
        <MetricCardShell
          title="Leadership role"
          value={m.data.salary_role && m.data.salary_role !== 'Member' ? m.data.salary_role : 'Member'}
          onExpand={() => setOpen(true)}
        />
      </div>

      {open && (
        <div role="dialog" aria-label="Leadership history" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}>
          <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 12, maxHeight: '80vh', overflow: 'auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>Leadership history</h3>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            {lead.isLoading ? <p>Loading…</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {(lead.data ?? []).map(r => (
                  <li key={r.id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
                    <strong>{r.role}</strong> · {r.start_date} – {r.end_date ?? 'present'}
                    <br /><small>
                      <a href={r.source_url} target="_blank" rel="noreferrer">→ source</a>
                    </small>
                  </li>
                ))}
                {(lead.data ?? []).length === 0 && <li>No leadership history ingested.</li>}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
