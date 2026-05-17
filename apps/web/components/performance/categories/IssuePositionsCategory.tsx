'use client'

import { useState } from 'react'
import {
  ALIGNMENT_LABEL,
  type CategoryId,
  scoreToTier,
  titleCaseIssueArea,
} from '@chiaro/ui-tokens'
import { useOfficialScorecardRatings, type ScorecardRatingWithOrg } from '@chiaro/officials'
import { useOfficialVotesOnSubject } from '@chiaro/bills'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'issue-positions'
const client = createSupabaseBrowserClient()

const SUBJECT_BY_AREA: Record<string, string> = {
  'environment':         'Environmental protection',
  'civil-liberties':     'Civil rights and liberties, minority issues',
  'civil-rights':        'Civil rights and liberties, minority issues',
  'reproductive-rights': 'Health',
  'liberal-policy':      'Government operations and politics',
  'conservative-policy': 'Government operations and politics',
  'business-policy':     'Commerce',
  'second-amendment':    'Firearms and explosives',
  'labor':               'Labor and employment',
}

function tierLabel(score: number, max: number): string {
  return ALIGNMENT_LABEL[scoreToTier(score, max)]
}

interface SubCascadeProps {
  isOpen: (categoryId: CategoryId, subId: string) => boolean
  onToggle: (categoryId: CategoryId, subId: string) => void
}

interface ScorecardCardInlineProps {
  rating: ScorecardRatingWithOrg
  officialId: string
}

function ScorecardCardInline({ rating, officialId }: ScorecardCardInlineProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const subject = SUBJECT_BY_AREA[rating.org.issue_area] ?? rating.org.issue_area
  const votes = useOfficialVotesOnSubject(client, officialId, subject, { enabled: open })
  const label = tierLabel(rating.score, rating.org.scoring_max)

  return (
    <article
      style={{
        border: '1px solid #d8d4c9',
        borderRadius: 6,
        padding: 12,
        background: 'linear-gradient(180deg, #f6f8fc 0%, #fff 100%)',
      }}
    >
      <div style={{ fontSize: '0.95rem', color: '#1a1714' }}>
        <strong>{titleCaseIssueArea(rating.org.issue_area)}</strong>{' '}
        <span style={{ color: '#807a72' }}>({rating.org.name})</span>
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1a1714', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color: '#807a72', marginTop: 6 }}>
        <a href={rating.org.methodology_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → methodology
        </a>{' '}·{' '}
        <a href={rating.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
          → org per-member page
        </a>{' '}·{' '}
        <span style={{ color: '#807a72' }}>numeric score: {rating.score} / {rating.org.scoring_max}</span>
      </div>
      <EvidenceExpand title={`Votes on bills tagged "${subject}"`} open={open} onToggle={() => setOpen(v => !v)}>
        {votes.isLoading ? <p>Loading…</p> : (() => {
          const rows = votes.data ?? []
          if (rows.length === 0) return <p style={{ fontSize: '0.82rem', color: '#807a72' }}>No matching votes ingested.</p>
          return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map(r => (
                <li key={r.vote_id} style={{ padding: '8px 0', borderTop: '1px solid #f0eee5', fontSize: '0.82rem' }}>
                  <strong>{r.position.toUpperCase()}</strong> on{' '}
                  <a href={r.bill.source_url} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1' }}>
                    {r.bill.bill_type.toUpperCase()} {r.bill.number}: {r.bill.title}
                  </a>
                </li>
              ))}
            </ul>
          )
        })()}
      </EvidenceExpand>
    </article>
  )
}

export function IssuePositionsCategory({ officialId, subCascade }: { officialId: string; subCascade: SubCascadeProps }): React.JSX.Element {
  const scorecards = useOfficialScorecardRatings(client, officialId)

  if (scorecards.isLoading) return <p style={{ padding: 12, color: '#807a72' }}>Loading…</p>
  const all = scorecards.data ?? []

  const groups = new Map<string, ScorecardRatingWithOrg[]>()
  for (const r of all) {
    const key = r.org.issue_area
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(r)
    } else {
      groups.set(key, [r])
    }
  }
  const sortedAreas = Array.from(groups.keys()).sort((a, b) =>
    titleCaseIssueArea(a).localeCompare(titleCaseIssueArea(b))
  )

  return (
    <div style={{ padding: 12 }}>
      {sortedAreas.map(area => {
        const ratings = (groups.get(area) ?? [])
          .slice()
          .sort((a, b) => a.org.name.localeCompare(b.org.name))
        const teaser = ratings.map(r => `${r.org.name} ${tierLabel(r.score, r.org.scoring_max)}`).join(' · ')
        const open = subCascade.isOpen(CATEGORY, area)
        return (
          <div key={area}>
            <SubCascadeBar
              categoryId={CATEGORY}
              subId={area}
              name={titleCaseIssueArea(area)}
              teaser={teaser}
              open={open}
              onToggle={() => subCascade.onToggle(CATEGORY, area)}
            />
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
                {ratings.map(r => (
                  <ScorecardCardInline key={r.id} rating={r} officialId={officialId} />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {sortedAreas.length === 0 && (
        <p style={{ color: '#807a72', fontSize: '0.82rem', textAlign: 'center', padding: 12 }}>
          No scorecards ingested for this representative yet.
        </p>
      )}
    </div>
  )
}
