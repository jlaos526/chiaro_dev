'use client'
import { useOfficialVotesOnSubject } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'

const client = createSupabaseBrowserClient()

export function ScorecardEvidenceDrawer({
  rating, officialId, onClose,
}: {
  rating: ScorecardRatingWithOrg
  officialId: string
  onClose: () => void
}) {
  // Drill-down: votes on bills tagged with this scorecard's issue_area.
  // (Slice 4 maps issue_area → subject directly. Slice 6+ refines per-scorecard mapping.)
  const subject = mapIssueAreaToSubject(rating.org.issue_area)
  const q = useOfficialVotesOnSubject(client, officialId, subject)

  return (
    <div role="dialog" aria-label={`${rating.org.name} evidence`} style={overlayStyle}>
      <div style={drawerStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{rating.org.name} — Evidence</h3>
          <button onClick={onClose} aria-label="Close evidence drawer">×</button>
        </header>
        <p>
          Score: <strong>{rating.score} / {rating.org.scoring_max}</strong> ·{' '}
          <a href={rating.source_url} target="_blank" rel="noreferrer">org's per-member page →</a>
        </p>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>
          Below: this official's votes on bills tagged "{subject}". Their methodology may weight different bills differently —
          <a href={rating.org.methodology_url} target="_blank" rel="noreferrer"> see methodology</a> for the exact scoring rubric.
        </p>
        {q.isLoading && <p>Loading…</p>}
        {q.data && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {q.data.map((row) => (
              <li key={row.vote_id} style={{ padding: '8px 0', borderTop: '1px solid #eee' }}>
                <strong>{row.position.toUpperCase()}</strong> on{' '}
                <a href={row.bill.source_url} target="_blank" rel="noreferrer">
                  {row.bill.bill_type.toUpperCase()} {row.bill.number}: {row.bill.title}
                </a>
              </li>
            ))}
            {q.data.length === 0 && <li style={{ color: '#999' }}>No votes on bills tagged "{subject}" found in slice-4 ingest.</li>}
          </ul>
        )}
      </div>
    </div>
  )
}

function mapIssueAreaToSubject(issueArea: string): string {
  // Initial mapping; slice 6+ refines per-scorecard.
  const map: Record<string, string> = {
    environment:      'Environmental protection',
    'civil-liberties': 'Civil rights and liberties, minority issues',
    'civil-rights':   'Civil rights and liberties, minority issues',
    labor:            'Labor and employment',
    healthcare:       'Health',
    business:         'Commerce',
    'gun-rights':     'Firearms and explosives',
  }
  return map[issueArea] ?? issueArea
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, padding: 16 } as const
const drawerStyle = { maxWidth: 720, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 12, maxHeight: '80vh', overflow: 'auto' } as const
