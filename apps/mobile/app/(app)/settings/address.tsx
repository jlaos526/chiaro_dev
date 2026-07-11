import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { addressInputSchema, getMyLocation } from '@chiaro/location'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BrandBodyText,
} from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'

export default function EditAddressScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    getMyLocation(supabase as never)
      .then((loc) => {
        if (loc) {
          setAddress(loc.home_address_text)
          setCalibratedAt(loc.calibrated_at)
        }
        setBootstrapping(false)
      })
      .catch(() => setBootstrapping(false))
  }, [])

  async function save() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address.')
      return
    }
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError("We couldn't find that address.")
      else if (status === 502) setError('Service unavailable. Try again.')
      else setError('Could not save.')
      return
    }
    router.push('/settings' as never)
  }

  const drawerScreen = (
    <Drawer.Screen
      options={{
        title: 'Home address',
        drawerItemStyle: { display: 'none' },
        headerLeft: () => <BackButton />,
      }}
    />
  )

  if (bootstrapping) {
    return (
      <>
        {drawerScreen}
        <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
          <BrandBodyText muted>Loading…</BrandBodyText>
        </BrandFormScreen>
      </>
    )
  }

  const subtitle = calibratedAt
    ? `Last updated ${new Date(calibratedAt).toLocaleString()}`
    : undefined

  return (
    <>
      {drawerScreen}
      <BrandFormScreen
        title="Home address"
        backHref="/settings"
        backLabel="← Settings"
        {...(subtitle ? { subtitle } : {})}
      >
        <BrandTextInput label="Address" value={address} onChangeText={setAddress} required />
        {error ? (
          <BrandAlert severity="danger" title="Couldn't save">
            {error}
          </BrandAlert>
        ) : null}
        <BrandButton variant="primary" disabled={loading} onPress={save}>
          {loading ? 'Saving…' : 'Save'}
        </BrandButton>
      </BrandFormScreen>
    </>
  )
}
