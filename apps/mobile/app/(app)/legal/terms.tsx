// Slice 78 (audit C26): the mobile Settings "Terms of service" row pushed
// /legal/terms while NO such mobile route existed — an as-never cast hid
// the dead link since slice 39. Mirrors the web placeholder page.
import { Drawer } from 'expo-router/drawer'
import { Text, View } from 'react-native'
import { SettingsScreen, useBrandTokens } from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'

export default function TermsOfService() {
  const { semantic } = useBrandTokens()
  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Terms of service',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SettingsScreen title="Terms of Service">
        <View
          style={{
            backgroundColor: semantic.bg.card,
            borderColor: semantic.border.default,
            borderWidth: 1,
            borderRadius: 12,
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ color: semantic.text.body, fontSize: 14, lineHeight: 20 }}>
            Chiaro's full terms of service are still being written. Until then, the short version:
            use the app in good faith, don't try to break things, and remember that elected-official
            records are aggregated from public sources and may contain errors.
          </Text>
          <Text style={{ color: semantic.text.body, fontSize: 14, lineHeight: 20 }}>
            You can delete your account at any time from the settings page. We'll remove your home
            address and any related calibration data within 30 days.
          </Text>
          <Text style={{ color: semantic.text.muted, fontSize: 13, lineHeight: 18 }}>
            Last updated: placeholder. Full terms with liability + arbitration clauses coming before
            public launch.
          </Text>
        </View>
      </SettingsScreen>
    </>
  )
}
