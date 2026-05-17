'use client'

import { useState } from 'react'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useOfficialMetrics,
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MetricCardShell } from '@/components/cards/MetricCardShell'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'community-presence'
const client = createSupabaseBrowserClient()
const CONGRESS = '119'

function mapsUrl(addr: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`
}

function isRecent(eventDate: string, days = 90): boolean {
  const event = new Date(eventDate).getTime()
  const now = Date.now()
  return event >= now - days * 24 * 60 * 60 * 1000 && event <= now
}

export function CommunityPresenceCategory({ officialId }: { officialId: string }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const [officesOpen, setOfficesOpen] = useState(false)
  const [hallsOpen, setHallsOpen] = useState(false)
  const offices = useOfficialDistrictOffices(client, officialId, { enabled: officesOpen })
  const halls = useOfficialTownHalls(client, officialId, CONGRESS, { enabled: hallsOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 12 }}>
      <MetricCardShell
        categoryId={CATEGORY}
        value={m?.lives_in_district == null ? 'N/A (Senate)' : m.lives_in_district ? '✓ Yes' : '✗ No'}
        label="Lives in District"
        caption={m?.home_district_id ? 'home maps to a district' : 'address outside represented district'}
        externalSourceUrl="https://www.fec.gov/data/"
      />

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f3faf8 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.district_offices_count ?? 0}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9b88', marginRight: 6, display: 'inline-block' }} />
          District Offices
        </div>
        <EvidenceExpand title="Office locations" open={officesOpen} onToggle={() => setOfficesOpen(v => !v)}>
          {offices.isLoading ? <p>Loading…</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(offices.data ?? []).map(o => {
                const full = `${o.address}, ${o.city}, ${o.state} ${o.zip ?? ''}`.trim()
                return (
                  <li key={o.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                    <strong>{o.city}, {o.state}</strong><br />
                    {o.address} {o.zip}<br />
                    {o.phone && <a href={`tel:${o.phone}`} style={{ color: '#3b6ed1' }}>{o.phone}</a>}{' '}
                    <a href={mapsUrl(full)} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ open in Google Maps</a>{' '}
                    <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ source</a>
                  </li>
                )
              })}
              {(offices.data ?? []).length === 0 && <li style={{ padding: '6px 0', color: '#807a72' }}>No district offices listed.</li>}
            </ul>
          )}
        </EvidenceExpand>
      </article>

      <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f3faf8 0%, #fff 100%)' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
          {m?.town_halls_count ?? 0}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9b88', marginRight: 6, display: 'inline-block' }} />
          Town Halls (119th)
        </div>
        <EvidenceExpand title="Town halls" open={hallsOpen} onToggle={() => setHallsOpen(v => !v)}>
          {halls.isLoading ? <p>Loading…</p> : (() => {
            const data = halls.data ?? []
            if (data.length === 0) return <p style={{ color: '#807a72', fontSize: '0.82rem' }}>No town halls in the 119th Congress.</p>
            const recent = data.filter(h => isRecent(h.event_date))
            const formatCounts = data.reduce<Record<string, number>>((acc, h) => {
              const key = h.format ?? 'unknown'
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})
            return (
              <>
                <p style={{ fontSize: '0.78rem', color: '#5a5751', margin: '0 0 6px' }}>
                  {recent.length} in last 90 days · last event: {data[0]?.event_date ?? '—'}<br />
                  By format: {Object.entries(formatCounts).map(([k, v]) => `${k} ${v}`).join(' · ')}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.map(h => (
                    <li key={h.id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem', color: '#1a1714' }}>
                      <strong>{h.event_date}</strong> · {h.city ?? '?'}, {h.state ?? '?'} · {h.format ?? '?'}{' '}
                      <a href={h.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#3b6ed1' }}>→ Town Hall Project</a>
                    </li>
                  ))}
                </ul>
              </>
            )
          })()}
        </EvidenceExpand>
      </article>
    </div>
  )
}
