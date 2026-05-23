import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Text, View } from 'react-native'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { ChiaroClientProvider, useChiaroClient } from '../src/client-context.tsx'

function Probe() {
  const c = useChiaroClient()
  return <Text testID="probe">{c ? 'client' : 'null'}</Text>
}

describe('ChiaroClientProvider', () => {
  it('exposes client to descendants via useChiaroClient', () => {
    const fakeClient = { from: () => {} } as unknown as ChiaroClient
    const { getByTestId } = render(
      <ChiaroClientProvider client={fakeClient}>
        <Probe />
      </ChiaroClientProvider>,
    )
    expect(getByTestId('probe').textContent).toBe('client')
  })

  it('throws when used without a Provider', () => {
    const orig = console.error
    console.error = () => {}
    try {
      expect(() => render(<View><Probe /></View>)).toThrow(
        /useChiaroClient must be used inside <ChiaroClientProvider>/,
      )
    } finally {
      console.error = orig
    }
  })
})
