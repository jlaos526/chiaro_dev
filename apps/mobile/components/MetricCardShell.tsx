import { Text, Pressable, Linking } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

interface BaseProps {
  title: string
  value: string | number
  caption?: string
}
type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
export type MetricCardShellProps = BaseProps & DrillDown

export function MetricCardShell(props: MetricCardShellProps) {
  const { title, value, caption } = props
  const onPress = 'onExpand' in props && props.onExpand
    ? props.onExpand
    : () => Linking.openURL(props.externalSourceUrl!)
  const cta = 'onExpand' in props && props.onExpand ? 'view evidence →' : 'view source →'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}. ${cta}`}
      style={{
        borderColor: COLORS.neutral.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        backgroundColor: COLORS.neutral.background,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: COLORS.neutral.textMuted,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.brand.text }}>{value}</Text>
      {caption ? (
        <Text style={{ fontSize: 13, color: COLORS.neutral.mute, marginTop: 2 }}>{caption}</Text>
      ) : null}
      <Text style={{ fontSize: 13, color: COLORS.brand.primary, marginTop: 6 }}>{cta}</Text>
    </Pressable>
  )
}
