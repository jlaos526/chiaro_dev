import { Drawer } from 'expo-router/drawer'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BackButton, CalibrateScreen } from '@chiaro/officials-ui'
import { addressInputSchema } from '@chiaro/location'
import { supabase } from '@/lib/supabase'
import { getCurrentLocation } from '@/lib/location-permissions'

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

  async function handleGpsSubmit() {
    const result = await getCurrentLocation()
    if (!result.ok) throw new Error(result.message)

    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { lat: result.lat, lng: result.lng },
    })
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 422) throw new Error("We can't resolve districts for that location yet.")
      if (status === 502) throw new Error('Location lookup is temporarily unavailable. Try again.')
      throw new Error('Something went wrong. Try again.')
    }
    router.replace('/')
  }

  async function handleSkip() {
    await AsyncStorage.setItem('chiaro_skip_calibrate', '1')
    router.replace('/')
  }

  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Calibrate',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <CalibrateScreen onSubmit={handleSubmit} onGpsSubmit={handleGpsSubmit} onSkip={handleSkip} />
    </>
  )
}
