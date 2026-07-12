'use client'

import { useRouter } from 'next/navigation'
import { CalibrateScreen, SAMPLE_CALIBRATE_ADDRESS } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema } from '@chiaro/location'
import { mapCalibrateError } from '@/lib/calibrate-error'

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
      throw new Error(mapCalibrateError(status))
    }
    router.push('/')
    router.refresh()
  }

  function handleSkip() {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
    router.push('/')
  }

  return (
    <CalibrateScreen
      onSubmit={handleSubmit}
      onSkip={handleSkip}
      sampleAddress={SAMPLE_CALIBRATE_ADDRESS}
      sampleLabel="Or try a sample address (San Francisco City Hall)"
    />
  )
}
