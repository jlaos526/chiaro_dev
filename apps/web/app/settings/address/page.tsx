'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema, getMyLocation } from '@chiaro/location'

export default function EditAddressPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      if (status === 400) setError('We couldn\'t find that address.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Could not save. Try again.')
      return
    }
    router.push('/settings')
    router.refresh()
  }

  if (bootstrapping) return <p>Loading…</p>

  return (
    <section>
      <h2>Home address</h2>
      {calibratedAt && <p><small>Last updated {new Date(calibratedAt).toLocaleString()}</small></p>}
      <form onSubmit={handleSubmit}>
        <label>
          Address
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            required
            minLength={5}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  )
}
