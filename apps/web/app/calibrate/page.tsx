'use client'

import { useRouter } from 'next/navigation'
import { CalibrateScreen } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema } from '@chiaro/location'

export default function CalibratePage(): React.JSX.Element {
  const router = useRouter()

  async function handleSubmit(address: string) {
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) throw new Error('Enter a complete address (street, city, state, ZIP).')

    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) throw new Error("We couldn't find that address. Double-check spelling.")
      if (status === 422) throw new Error("We can't resolve districts for that location yet.")
      if (status === 502) throw new Error("Address lookup is temporarily unavailable. Try again.")
      throw new Error("Something went wrong saving your location. Try again.")
    }
    router.push('/')
    router.refresh()
  }

  function handleSkip() {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
    router.push('/')
  }

  return <CalibrateScreen onSubmit={handleSubmit} onSkip={handleSkip} />
}
