'use client'

import { createElement } from 'react'
import { Platform } from 'react-native'
import { AuthWordmark } from './AuthWordmark.tsx'
import { AuthCrossLink, type AuthCrossLinkProps } from './AuthCrossLink.tsx'

export interface AuthPageChromeProps {
  rightCrossLink: { mode: AuthCrossLinkProps['mode']; href: string; onPress: () => void }
}

export function AuthPageChrome({ rightCrossLink }: AuthPageChromeProps): React.JSX.Element {
  if (Platform.OS !== 'web') return <></>

  return createElement(
    'div',
    {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 18px',
        zIndex: 1,
      },
    },
    createElement(AuthWordmark, { size: 'sm' }),
    createElement(AuthCrossLink, { mode: rightCrossLink.mode, onPress: rightCrossLink.onPress, href: rightCrossLink.href }),
  )
}
