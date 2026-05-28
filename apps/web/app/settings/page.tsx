'use client'

import { useRouter } from 'next/navigation'
import {
  BrandModeThemeRow,
  SettingsActionRow,
  SettingsComingSoonRow,
  SettingsNavRow,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
  SettingsValueRow,
} from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

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
    <SettingsScreen>
      <SettingsSection title="Account">
        <SettingsNavRow
          label="Home address"
          href="/settings/address"
          onPress={() => router.push('/settings/address')}
        />
        <SettingsActionRow label="Sign out" danger onPress={handleSignOut} />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <BrandModeThemeRow />
      </SettingsSection>

      <SettingsSection title="Notifications" description="Coming soon">
        <SettingsToggleRow label="Push notifications" value={false} disabled onChange={() => {}} />
        <SettingsToggleRow label="Email digest" value={false} disabled onChange={() => {}} />
      </SettingsSection>

      <SettingsSection title="Profile">
        <SettingsComingSoonRow label="Display name" />
        <SettingsComingSoonRow label="Avatar" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsValueRow label="Version" value={APP_VERSION} />
        <SettingsNavRow
          label="Privacy policy"
          href="/legal/privacy"
          onPress={() => router.push('/legal/privacy')}
        />
        <SettingsNavRow
          label="Terms of service"
          href="/legal/terms"
          onPress={() => router.push('/legal/terms')}
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
