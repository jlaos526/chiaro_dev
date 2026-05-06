'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }
  return (
    <ul>
      <li><Link href="/settings/address">Home address</Link></li>
      <li><button type="button" onClick={handleSignOut}>Sign out</button></li>
    </ul>
  )
}
