import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// `/calibrate` is a 'use client' island that renders CalibrateScreen — no
// server-side auth guard. Mock CalibrateScreen as a div that surfaces the
// onSubmit/onSkip callbacks so we can exercise the page's submit + skip wiring.
const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const { functionsInvoke } = vi.hoisted(() => ({ functionsInvoke: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  }),
}))

let capturedSubmit: ((address: string) => Promise<void>) | null = null
let capturedSkip: (() => void) | null = null
vi.mock('@chiaro/officials-ui', () => ({
  CalibrateScreen: ({
    onSubmit,
    onSkip,
  }: {
    onSubmit: (address: string) => Promise<void>
    onSkip: () => void
  }) => {
    capturedSubmit = onSubmit
    capturedSkip = onSkip
    return <div data-testid="calibrate-screen" />
  },
}))

import CalibratePage from '../../app/calibrate/page'

describe('calibrate page', () => {
  it('mounts the CalibrateScreen island', () => {
    const { container } = render(<CalibratePage />)
    expect(container.querySelector('[data-testid="calibrate-screen"]')).toBeTruthy()
  })

  it('submits a valid address + routes to / on success', async () => {
    functionsInvoke.mockResolvedValueOnce({ error: null })
    render(<CalibratePage />)
    await capturedSubmit!('123 Main St, Springfield IL 62701')
    expect(functionsInvoke).toHaveBeenCalledWith('calibrate-location', {
      body: { address: '123 Main St, Springfield IL 62701' },
    })
    expect(pushMock).toHaveBeenCalledWith('/')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('rejects an incomplete address before invoking the Edge Function', async () => {
    render(<CalibratePage />)
    await expect(capturedSubmit!('')).rejects.toThrow(/complete address/i)
    expect(functionsInvoke).not.toHaveBeenCalled()
  })

  it('skips calibration + routes to /', () => {
    render(<CalibratePage />)
    capturedSkip!()
    expect(pushMock).toHaveBeenCalledWith('/')
  })
})
