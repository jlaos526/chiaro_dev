'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema } from '@chiaro/location'

export default function CalibratePage(): React.JSX.Element {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      if (status === 400) setError('We couldn\'t find that address. Double-check spelling.')
      else if (status === 422) setError('We can\'t resolve districts for that location yet.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Something went wrong saving your location. Try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  function handleSkip() {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
    router.push('/')
  }

  return (
    <main>
      <h1>Set your home location</h1>
      <p>We'll use this to show you the elected officials representing your address.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Address
          <input
            type="text"
            placeholder="123 Main St, Brooklyn, NY 11201"
            value={address}
            onChange={e => setAddress(e.target.value)}
            required
            minLength={5}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Calibrating…' : 'Calibrate'}
        </button>
      </form>
      <p>
        <button type="button" onClick={handleSkip}>Skip for now</button>
      </p>
    </main>
  )
}
