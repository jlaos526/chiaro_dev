'use client'

import { useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useOfficialStateVotesOnSubject } from '@chiaro/state-bills'
import { COLORS } from '@chiaro/ui-tokens'

// Maps a scorecard org's issue_area to candidate subject strings that may
// appear on state_bill_subjects.subject (varies per state). Conservative
// listing — better to under-match than over-match for the v1 evidence panel.
const SUBJECT_BY_AREA_STATE: Record<string, string[]> = {
  'environment':         ['Environment', 'Energy', 'Climate'],
  'civil-liberties':     ['Civil rights', 'Privacy', 'Civil liberties'],
  'reproductive-rights': ['Health', 'Reproductive rights'],
  'second-amendment':    ['Firearms', 'Guns'],
  'business-policy':     ['Commerce', 'Business', 'Taxation'],
  'liberal-policy':      ['Government operations'],
  'conservative-policy': ['Government operations'],
  'labor':               ['Labor', 'Employment'],
}

interface Props { officialId: string; issueArea: string }

export function StateIssueVotesEvidence({ officialId, issueArea }: Props): React.JSX.Element {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const subjects = SUBJECT_BY_AREA_STATE[issueArea] ?? []
  const { data, isLoading } = useOfficialStateVotesOnSubject(client, officialId, subjects)

  if (isLoading) {
    return (
      <div style={{ color: COLORS.neutral.textMuted, fontSize: 13, padding: '8px 12px' }}>
        Loading evidence votes…
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          color: COLORS.neutral.textMuted,
          fontSize: 13,
          padding: '8px 12px',
          fontStyle: 'italic',
        }}
      >
        No matching votes for this subject area in current session.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {data.slice(0, 5).map(vp => (
        <div
          key={vp.vote.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '6px 10px',
            background: COLORS.neutral.surface,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, color: COLORS.brand.text }}>
              {vp.vote.bill?.bill_type} {vp.vote.bill?.number} — {vp.vote.bill?.title}
            </div>
            <div style={{ color: COLORS.neutral.textMuted, fontSize: 12 }}>
              {vp.vote.question} · {vp.vote.vote_date}
            </div>
          </div>
          <div
            style={{
              fontWeight: 600,
              color:
                vp.position === 'yes'
                  ? COLORS.signal.success
                  : vp.position === 'no'
                  ? COLORS.signal.error
                  : COLORS.neutral.textMuted,
            }}
          >
            {vp.position.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  )
}
