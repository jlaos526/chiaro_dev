'use client'

import { type CategoryId } from '@chiaro/ui-tokens'
import { useOfficialMetrics } from '@chiaro/officials'
import { useOfficialMissedVotes, useOfficialSponsoredBills, useOfficialCosponsoredBills } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

const CATEGORY: CategoryId = 'voting-bills'
const client = createSupabaseBrowserClient()
const CONGRESS = '119'

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

export function VotingBillsCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const metrics = useOfficialMetrics(client, officialId)
  const votingOpen = subCascade.isOpen(CATEGORY, 'voting-record')
  const billsOpen = subCascade.isOpen(CATEGORY, 'bills-authored')

  const missed = useOfficialMissedVotes(client, officialId, CONGRESS, { enabled: votingOpen })
  const sponsored = useOfficialSponsoredBills(client, officialId, CONGRESS, { enabled: billsOpen })
  const cosponsored = useOfficialCosponsoredBills(client, officialId, CONGRESS, { enabled: billsOpen })

  if (metrics.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const m = metrics.data

  return (
    <div style={{ padding: 12 }}>
      <SubCascadeBar
        categoryId={CATEGORY}
        subId="voting-record"
        name="Voting Record"
        teaser={m?.attendance_pct != null ? `${m.attendance_pct}% attendance` : 'no attendance data'}
        open={votingOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'voting-record')}
      />
      {votingOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1714', lineHeight: 1.1 }}>
              {m?.attendance_pct != null ? `${m.attendance_pct}%` : '—'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#1a1714', marginTop: 8, display: 'flex', alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d57c1', marginRight: 6, display: 'inline-block' }} />
              Attendance
            </div>
            <div style={{ fontSize: '0.7rem', color: '#807a72', marginTop: 2 }}>
              {m?.votes_voted_count ?? 0}/{m?.total_roll_calls ?? 0} roll calls
            </div>
            <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#1a1714' }}>
              <strong>Missed votes:</strong>
              {missed.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                  {(missed.data ?? []).map(mv => (
                    <li key={mv.vote_id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                      <a href={mv.vote.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                        {mv.vote.vote_date} · {mv.vote.question}
                      </a>
                    </li>
                  ))}
                  {(missed.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
                </ul>
              )}
            </div>
          </article>
        </div>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="bills-authored"
        name="Bills Authored"
        teaser={`${m?.bills_sponsored_count ?? 0} sponsored, ${m?.bills_cosponsored_count ?? 0} cosponsored`}
        open={billsOpen}
        onToggle={() => subCascade.onToggle(CATEGORY, 'bills-authored')}
      />
      {billsOpen && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1714', marginBottom: 6 }}>Sponsored</div>
            {sponsored.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(sponsored.data ?? []).map(b => (
                  <li key={b.id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.78rem' }}>
                    <a href={b.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                      {b.bill_type.toUpperCase()} {b.number}: {b.title}
                    </a>
                  </li>
                ))}
                {(sponsored.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
              </ul>
            )}
          </article>
          <article style={{ border: '1px solid #d8d4c9', borderRadius: 6, padding: 12, background: 'linear-gradient(180deg, #f7f4fc 0%, #fff 100%)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1714', marginBottom: 6 }}>Cosponsored</div>
            {cosponsored.isLoading ? <p style={{ fontSize: '0.78rem' }}>Loading…</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(cosponsored.data ?? []).map(b => (
                  <li key={b.id} style={{ padding: '6px 0', borderTop: '1px solid #f0eee5', fontSize: '0.78rem' }}>
                    <a href={b.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                      {b.bill_type.toUpperCase()} {b.number}: {b.title}
                    </a>
                  </li>
                ))}
                {(cosponsored.data ?? []).length === 0 && <li style={{ color: '#807a72', fontSize: '0.78rem' }}>None this Congress.</li>}
              </ul>
            )}
          </article>
        </div>
      )}

      <SubCascadeBar
        categoryId={CATEGORY}
        subId="committee-work"
        name="Committee Work"
        teaser="data coming slice 5+"
        open={false}
        onToggle={() => { /* placeholder */ }}
        placeholder={true}
      />
    </div>
  )
}
