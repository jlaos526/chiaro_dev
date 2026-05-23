import { Text, View } from 'react-native'

export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

export function PillChevron({ open, size = 'md' }: PillChevronProps): React.JSX.Element {
  const dim = size === 'sm' ? 18 : 20
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: '#f0eee5',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#1a1714', fontSize: 10, fontWeight: '700' }}>
        {open ? '▾' : '▸'}
      </Text>
    </View>
  )
}
