import { useState } from 'react'
import { View, Text, Modal, ScrollView, Pressable, Linking } from 'react-native'
import { useOfficialVotesOnSubject } from '@chiaro/bills'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { MetricCardShell } from './MetricCardShell'

export function ScorecardCard({
  rating,
  officialId,
}: {
  rating: ScorecardRatingWithOrg
  officialId: string
}) {
  const [open, setOpen] = useState(false)
  const subject = mapSubject(rating.org.issue_area)
  const q = useOfficialVotesOnSubject(supabase, officialId, subject, { enabled: open })

  return (
    <>
      <MetricCardShell
        title={`${rating.org.name} (${rating.org.issue_area})`}
        value={`${rating.score}/${rating.org.scoring_max}`}
        caption={rating.org.lean as string}
        onExpand={() => setOpen(true)}
      />
      <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="slide">
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Pressable onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ fontSize: 18 }}>×</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{rating.org.name} — Evidence</Text>
          <Text style={{ marginTop: 8 }}>
            Score {rating.score}/{rating.org.scoring_max}
          </Text>
          <Pressable onPress={() => Linking.openURL(rating.source_url)}>
            <Text style={{ color: '#5b6cff' }}>→ org's per-member page</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(rating.org.methodology_url)}>
            <Text style={{ color: '#5b6cff' }}>→ methodology</Text>
          </Pressable>
          <Text style={{ marginTop: 16, fontWeight: '600' }}>
            Votes on bills tagged "{subject}":
          </Text>
          {q.isLoading ? (
            <Text>Loading…</Text>
          ) : (
            <View>
              {(q.data ?? []).map((row) => (
                <Pressable
                  key={row.vote_id}
                  onPress={() => Linking.openURL(row.bill.source_url)}
                  style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: '#eee' }}
                >
                  <Text style={{ fontWeight: '700' }}>{row.position.toUpperCase()}</Text>
                  <Text>
                    {row.bill.bill_type.toUpperCase()} {row.bill.number}: {row.bill.title}
                  </Text>
                </Pressable>
              ))}
              {(q.data ?? []).length === 0 && (
                <Text style={{ color: '#999', marginTop: 8 }}>No matching votes ingested.</Text>
              )}
            </View>
          )}
        </ScrollView>
      </Modal>
    </>
  )
}

function mapSubject(area: string): string {
  const map: Record<string, string> = {
    environment: 'Environmental protection',
    'civil-liberties': 'Civil rights and liberties, minority issues',
    'civil-rights': 'Civil rights and liberties, minority issues',
    labor: 'Labor and employment',
    healthcare: 'Health',
    business: 'Commerce',
    'gun-rights': 'Firearms and explosives',
  }
  return map[area] ?? area
}
