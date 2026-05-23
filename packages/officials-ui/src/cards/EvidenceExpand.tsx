import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { PillChevron } from './PillChevron.tsx'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function EvidenceExpand({
  title,
  open,
  onToggle,
  children,
}: EvidenceExpandProps): React.JSX.Element {
  return (
    <View>
      {open ? (
        <View
          style={{
            marginTop: 14,
            borderTopWidth: 1,
            borderTopColor: '#d8d4c9',
            borderStyle: 'dashed',
            paddingTop: 12,
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: 13,
              color: '#1a1714',
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          {children}
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <PillChevron open={open} />
          <Text style={{ color: '#1a1714', fontSize: 13, fontWeight: '600' }}>
            {open ? 'Hide evidence' : 'view evidence'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
