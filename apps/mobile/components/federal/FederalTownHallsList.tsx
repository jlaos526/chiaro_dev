import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type TownHallRow = Database['public']['Tables']['town_halls']['Row']

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  phone: 'Phone',
  hybrid: 'Hybrid',
}

interface Props { rows: TownHallRow[] }

export function FederalTownHallsList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No town halls in the past 12 months.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <Pressable
          key={r.id}
          onPress={() => Linking.openURL(r.source_url)}
          style={styles.row}
        >
          <Text style={styles.title}>
            {r.event_date}
            {r.city ? ` · ${r.city}, ${r.state ?? ''}` : r.state ? ` · ${r.state}` : ''}
          </Text>
          <Text style={styles.meta}>
            {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
            {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
  },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
