import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CalibrateScreen } from '@chiaro/officials-ui'
import { addressInputSchema } from '@chiaro/location'
import { supabase } from '@/lib/supabase'

// Slice 39 task 9. Mobile mirrors web task 8 — thin shell around
// CalibrateScreen. The pre-slice-39 mobile screen also offered a
// "Use my current location" GPS path via `getCurrentLocation()`; the
// slice 39 CalibrateScreen component only exposes an address-entry
// surface, so the GPS path is dropped here for now. Restoring it is a
// follow-up — either extend CalibrateScreen with an optional onGpsSubmit
// prop or wrap CalibrateScreen with a mobile-only GPS row above the card.

export default function CalibratePage() {
  const router = useRouter()

  async function handleSubmit(address: string) {
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) throw new Error('Enter a complete address (street, city, state, ZIP).')

    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) throw new Error("We couldn't find that address. Double-check spelling.")
      if (status === 422) throw new Error("We can't resolve districts for that location yet.")
      if (status === 502) throw new Error('Address lookup is temporarily unavailable. Try again.')
      throw new Error('Something went wrong. Try again.')
    }
    router.replace('/')
  }

  async function handleSkip() {
    await AsyncStorage.setItem('chiaro_skip_calibrate', '1')
    router.replace('/')
  }

  return <CalibrateScreen onSubmit={handleSubmit} onSkip={handleSkip} />
}
