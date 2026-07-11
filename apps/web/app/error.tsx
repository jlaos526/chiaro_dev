'use client'

import { View } from 'react-native'
import { BrandAlert, BrandButton, BrandPageScreen } from '@chiaro/officials-ui'

/**
 * Global route error boundary (slice 70, audit U2-web rider). Before this,
 * an unhandled RSC/render throw showed Next's default unstyled error page.
 * Renders INSIDE the root layout (providers intact), replacing the failed
 * page segment; `reset()` re-renders the segment.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.JSX.Element {
  return (
    <BrandPageScreen title="Something went wrong">
      <BrandAlert severity="danger" title="This page hit an unexpected error">
        {error.digest ? `Your data is fine — try again. (ref ${error.digest})` : 'Your data is fine — try again.'}
      </BrandAlert>
      <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
        <BrandButton onPress={reset}>Try again</BrandButton>
      </View>
    </BrandPageScreen>
  )
}
