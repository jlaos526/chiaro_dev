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
    // `/sign-in` lives under the `(auth)` group (group segments are elided
    // from the URL path). Slice 78 removed the app-wide as-never href
    // convention — plain paths typecheck and a CI guard keeps casts out.
    router.replace('/sign-in')
  }

  return (
    <>
      <Drawer.Screen options={{ title: 'Settings' }} />
      <SettingsScreen>
        <SettingsSection title="Account">
          <SettingsNavRow label="Home address" onPress={() => router.push('/settings/address')} />
          <SettingsNavRow label="Issue priorities" onPress={() => router.push('/issues')} />
          <SettingsActionRow label="Sign out" danger onPress={handleSignOut} />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <BrandModeThemeRow />
        </SettingsSection>

        <SettingsSection title="Notifications" description="Coming soon">
          <SettingsToggleRow
            label="Push notifications"
            value={false}
            disabled
            onChange={() => {}}
          />
          <SettingsToggleRow label="Email digest" value={false} disabled onChange={() => {}} />
        </SettingsSection>

        <SettingsSection title="Profile">
          <SettingsComingSoonRow label="Display name" />
          <SettingsComingSoonRow label="Avatar" />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsValueRow label="Version" value={APP_VERSION} />
          {/* Slice 78 (audit C26): these rows pushed routes that DIDN'T EXIST
            on mobile — the `as never` casts hid the dead links since slice 39.
            The (app)/legal screens now exist, mirroring the web placeholders. */}
          <SettingsNavRow label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
          <SettingsNavRow label="Terms of service" onPress={() => router.push('/legal/terms')} />
        </SettingsSection>
      </SettingsScreen>
    </>
  )
}
