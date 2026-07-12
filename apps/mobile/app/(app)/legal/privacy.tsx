// Slice 78 (audit C26) added this screen; slice 79.5 swaps the placeholder
// text for the shared honest demo copy (LegalBody keeps web + mobile in sync).
import { Drawer } from 'expo-router/drawer'
import { LegalBody, PRIVACY_COPY, SettingsScreen } from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'

export default function PrivacyPolicy() {
  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Privacy policy',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <SettingsScreen title="Privacy Policy">
        <LegalBody copy={PRIVACY_COPY} />
      </SettingsScreen>
    </>
  )
}
