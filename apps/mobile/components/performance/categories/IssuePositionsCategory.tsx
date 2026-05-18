import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import {
  ALIGNMENT_LABEL,
  type CategoryId,
  scoreToTier,
  titleCaseIssueArea,
} from '@chiaro/ui-tokens'
import { useOfficialScorecardRatings, type ScorecardRatingWithOrg } from '@chiaro/officials'
import { useOfficialVotesOnSubject } from '@chiaro/bills'
import { supabase } from '@/lib/supabase'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

const CATEGORY: CategoryId = 'issue-positions'

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
  const votes = useOfficialVotesOnSubject(supabase, officialId, subject, { enabled: open })
  const label = tierLabel(rating.score, rating.org.scoring_max)

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#d8d4c9',
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#f6f8fc',
      }}
    >
      <Text style={{ fontSize: 14, color: '#1a1714' }}>
        <Text style={{ fontWeight: '700' }}>{titleCaseIssueArea(rating.org.issue_area)}</Text>
        <Text style={{ color: '#807a72' }}> ({rating.org.name})</Text>
      </Text>
      <Text style={{ fontSize: 17, fontWeight: '600', color: '#1a1714', marginTop: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <Pressable onPress={() => Linking.openURL(rating.org.methodology_url).catch(() => {})}>
          <Text style={{ fontSize: 11, color: '#3b6ed1', textDecorationLine: 'underline' }}>→ methodology</Text>
        </Pressable>
        <Text style={{ fontSize: 11, color: '#807a72' }}> · </Text>
        <Pressable onPress={() => Linking.openURL(rating.source_url).catch(() => {})}>
          <Text style={{ fontSize: 11, color: '#3b6ed1', textDecorationLine: 'underline' }}>→ org per-member page</Text>
        </Pressable>
        <Text style={{ fontSize: 11, color: '#807a72' }}> · numeric score: {rating.score} / {rating.org.scoring_max}</Text>
      </View>
      <EvidenceExpand
        title={`Votes on bills tagged "${subject}"`}
        open={open}
        onToggle={() => setOpen(v => !v)}
      >
        {votes.isLoading ? (
          <Text style={{ fontSize: 13, color: '#5a5751' }}>Loading…</Text>
        ) : (() => {
          const rows = votes.data ?? []
          if (rows.length === 0) {
            return (
              <Text style={{ fontSize: 13, color: '#807a72' }}>No matching votes ingested.</Text>
            )
          }
          return (
            <View>
              {rows.map((r, i) => (
                <View
                  key={r.vote_id}
                  style={{
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: '#f0eee5',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#1a1714' }}>
                    <Text style={{ fontWeight: '700' }}>{r.position.toUpperCase()}</Text>
                    <Text> on </Text>
                  </Text>
                  <Pressable onPress={() => Linking.openURL(r.bill.source_url).catch(() => {})}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#3b6ed1',
                        textDecorationLine: 'underline',
                        marginTop: 2,
                      }}
                    >
                      {r.bill.bill_type.toUpperCase()} {r.bill.number}: {r.bill.title}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )
        })()}
      </EvidenceExpand>
    </View>
  )
}

export function IssuePositionsCategory({
  officialId,
  subCascade,
}: {
  officialId: string
  subCascade: SubCascadeProps
}): React.JSX.Element {
  const scorecards = useOfficialScorecardRatings(supabase, officialId)

  if (scorecards.isLoading) {
    return <Text style={{ padding: 12, color: '#807a72' }}>Loading…</Text>
  }
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
    <View style={{ padding: 12 }}>
      {sortedAreas.map(area => {
        const ratings = (groups.get(area) ?? [])
          .slice()
          .sort((a, b) => a.org.name.localeCompare(b.org.name))
        const teaser = ratings
          .map(r => `${r.org.name} ${tierLabel(r.score, r.org.scoring_max)}`)
          .join(' · ')
        const open = subCascade.isOpen(CATEGORY, area)
        return (
          <View key={area}>
            <SubCascadeBar
              categoryId={CATEGORY}
              subId={area}
              name={titleCaseIssueArea(area)}
              teaser={teaser}
              open={open}
              onToggle={() => subCascade.onToggle(CATEGORY, area)}
            />
            {open && (
              <View style={{ gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                {ratings.map(r => (
                  <ScorecardCardInline key={r.id} rating={r} officialId={officialId} />
                ))}
              </View>
            )}
          </View>
        )
      })}
      {sortedAreas.length === 0 && (
        <Text
          style={{
            color: '#807a72',
            fontSize: 13,
            textAlign: 'center',
            padding: 12,
          }}
        >
          No scorecards ingested for this representative yet.
        </Text>
      )}
    </View>
  )
}
