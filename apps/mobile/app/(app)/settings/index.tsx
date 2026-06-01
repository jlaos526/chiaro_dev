import { Drawer } from 'expo-router/drawer'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
import { supabase } from '@/lib/supabase'

const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? 'dev'

export default function SettingsIndex() {
  const router = useRouter()

  async function handleSignOut() {
    await AsyncStorage.removeItem('chiaro_skip_calibrate')
    await supabase.auth.signOut()
    // `/sign-in` lives under the `(auth)` group; typed-routes manifest doesn't
    // expose the bare path. Cast follows the existing `as never` convention
    // documented at apps/mobile/app/(app)/officials/[id].tsx:43 et al.
    router.replace('/sign-in' as never)
  }

  return (
    <>
      <Drawer.Screen options={{ title: 'Settings' }} />
      <SettingsScreen>
      <SettingsSection title="Account">
        <SettingsNavRow
          label="Home address"
          onPress={() => router.push('/settings/address')}
        />
        <SettingsNavRow
          label="Issue priorities"
          onPress={() => router.push('/issues')}
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
        {/* /legal/privacy + /legal/terms are not yet in the routes manifest;
            casting per existing apps/mobile/ convention until the legal pages
            ship (tracked as slice 39 follow-up). */}
        <SettingsNavRow label="Privacy policy" onPress={() => router.push('/legal/privacy' as never)} />
        <SettingsNavRow label="Terms of service" onPress={() => router.push('/legal/terms' as never)} />
      </SettingsSection>
    </SettingsScreen>
    </>
  )
}
