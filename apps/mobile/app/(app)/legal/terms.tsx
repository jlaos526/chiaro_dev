// Slice 78 (audit C26) added this screen; slice 79.5 swaps the placeholder
// text for the shared honest demo copy (LegalBody keeps web + mobile in sync).
import { Drawer } from 'expo-router/drawer'
import { LegalBody, SettingsScreen, TERMS_COPY } from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'

export default function TermsOfService() {
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
        <LegalBody copy={TERMS_COPY} />
      </SettingsScreen>
    </>
  )
}
