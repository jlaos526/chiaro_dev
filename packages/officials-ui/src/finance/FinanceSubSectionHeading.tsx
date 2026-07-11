import { Text, View } from 'react-native'

export interface FinanceSubSectionHeadingProps {
  label: string
  textColor: string
  ruleColor: string
}

export function FinanceSubSectionHeading({
  label,
  textColor,
  ruleColor,
}: FinanceSubSectionHeadingProps): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          fontWeight: '700',
          color: textColor,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: ruleColor }} />
    </View>
  )
}
