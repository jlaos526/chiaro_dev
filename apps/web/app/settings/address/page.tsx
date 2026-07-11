'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema, getMyLocation } from '@chiaro/location'
import { mapCalibrateError } from '@/lib/calibrate-error'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BrandBodyText,
} from '@chiaro/officials-ui'

export default function EditAddressPage(): React.JSX.Element {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
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

  async function handleSubmit() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address (street, city, state, ZIP).')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      setError(mapCalibrateError(status))
      return
    }
    router.push('/settings')
    router.refresh()
  }

  if (bootstrapping) {
    return (
      <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
        <BrandBodyText muted>Loading…</BrandBodyText>
      </BrandFormScreen>
    )
  }

  const subtitle = calibratedAt
    ? `Last updated ${new Date(calibratedAt).toLocaleString()}`
    : undefined

  return (
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
      <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
        {loading ? 'Saving…' : 'Save'}
      </BrandButton>
    </BrandFormScreen>
  )
}
