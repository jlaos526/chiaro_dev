import { render } from '@testing-library/react-native'

// Route handler test for apps/mobile/app/(app)/calibrate.tsx. The page's submit /
// gps / skip handlers are internal closures, so we mock @chiaro/officials-ui's
// CalibrateScreen to a no-render component that CAPTURES the onSubmit / onGpsSubmit /
// onSkip props, render <CalibratePage/>, then invoke the captured callbacks and
// assert the Edge Function calls + error-message mapping + router.replace('/').
// @chiaro/location stays REAL so addressInputSchema validation is genuinely exercised.
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11).

const VALID_ADDRESS = '350 5th Ave, New York, NY 10118'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))
jest.mock('expo-router/drawer', () => ({ Drawer: { Screen: () => null } }))
jest.mock('@chiaro/officials-ui/src/nav/BackButton.tsx', () => ({ BackButton: () => null }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
}))

const mockInvoke = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}))

const mockGetCurrentLocation = jest.fn()
jest.mock('@/lib/location-permissions', () => ({
  getCurrentLocation: () => mockGetCurrentLocation(),
}))

type CalibrateProps = {
  onSubmit: (address: string) => Promise<void>
  onGpsSubmit: () => Promise<void>
  onSkip: () => Promise<void>
}
let captured: CalibrateProps | null = null
jest.mock('@chiaro/officials-ui', () => ({
  CalibrateScreen: (props: CalibrateProps) => {
    captured = props
    return null
  },
}))

import CalibratePage from '../app/(app)/calibrate'

function mountAndCapture(): CalibrateProps {
  captured = null
  render(<CalibratePage />)
  if (!captured) throw new Error('CalibrateScreen props were not captured')
  return captured
}

describe('mobile /calibrate route handlers', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockInvoke.mockReset()
    mockGetCurrentLocation.mockReset()
  })

  describe('handleSubmit (address)', () => {
    it('rejects an invalid address before invoking the Edge Function', async () => {
      const { onSubmit } = mountAndCapture()
      await expect(onSubmit('x')).rejects.toThrow(
        'Enter a complete address (street, city, state, ZIP).',
      )
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('invokes calibrate-location with the address and replaces home on success', async () => {
      mockInvoke.mockResolvedValue({ error: null })
      const { onSubmit } = mountAndCapture()
      await onSubmit(VALID_ADDRESS)
      expect(mockInvoke).toHaveBeenCalledWith('calibrate-location', {
        body: { address: VALID_ADDRESS },
      })
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    it('maps status 400 to the spelling message', async () => {
      mockInvoke.mockResolvedValue({ error: { context: { status: 400 } } })
      const { onSubmit } = mountAndCapture()
      await expect(onSubmit(VALID_ADDRESS)).rejects.toThrow(
        "We couldn't find that address. Double-check spelling.",
      )
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('maps status 422 to the cannot-resolve message', async () => {
      mockInvoke.mockResolvedValue({ error: { context: { status: 422 } } })
      const { onSubmit } = mountAndCapture()
      await expect(onSubmit(VALID_ADDRESS)).rejects.toThrow(
        "We can't resolve districts for that location yet.",
      )
    })

    it('maps status 502 to the temporarily-unavailable message', async () => {
      mockInvoke.mockResolvedValue({ error: { context: { status: 502 } } })
      const { onSubmit } = mountAndCapture()
      await expect(onSubmit(VALID_ADDRESS)).rejects.toThrow(
        'Address lookup is temporarily unavailable. Try again.',
      )
    })

    it('maps an unknown status to the generic message', async () => {
      mockInvoke.mockResolvedValue({ error: { context: { status: 500 } } })
      const { onSubmit } = mountAndCapture()
      await expect(onSubmit(VALID_ADDRESS)).rejects.toThrow('Something went wrong. Try again.')
    })
  })

  describe('handleGpsSubmit', () => {
    it('rejects with the GPS message when getCurrentLocation is not ok', async () => {
      mockGetCurrentLocation.mockResolvedValue({
        ok: false,
        reason: 'denied',
        message: 'Location access is off.',
      })
      const { onGpsSubmit } = mountAndCapture()
      await expect(onGpsSubmit()).rejects.toThrow('Location access is off.')
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('invokes calibrate-location with lat/lng and replaces home on success', async () => {
      mockGetCurrentLocation.mockResolvedValue({ ok: true, lat: 40.7, lng: -74 })
      mockInvoke.mockResolvedValue({ error: null })
      const { onGpsSubmit } = mountAndCapture()
      await onGpsSubmit()
      expect(mockInvoke).toHaveBeenCalledWith('calibrate-location', {
        body: { lat: 40.7, lng: -74 },
      })
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    it('maps GPS status 422 to the cannot-resolve message', async () => {
      mockGetCurrentLocation.mockResolvedValue({ ok: true, lat: 40.7, lng: -74 })
      mockInvoke.mockResolvedValue({ error: { context: { status: 422 } } })
      const { onGpsSubmit } = mountAndCapture()
      await expect(onGpsSubmit()).rejects.toThrow(
        "We can't resolve districts for that location yet.",
      )
    })

    it('maps GPS status 502 to the location-unavailable message', async () => {
      mockGetCurrentLocation.mockResolvedValue({ ok: true, lat: 40.7, lng: -74 })
      mockInvoke.mockResolvedValue({ error: { context: { status: 502 } } })
      const { onGpsSubmit } = mountAndCapture()
      await expect(onGpsSubmit()).rejects.toThrow(
        'Location lookup is temporarily unavailable. Try again.',
      )
    })
  })

  describe('handleSkip', () => {
    it('replaces home after recording the skip flag', async () => {
      const { onSkip } = mountAndCapture()
      await onSkip()
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })
})
