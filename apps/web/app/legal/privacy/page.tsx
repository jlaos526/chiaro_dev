'use client'

import { Text, View } from 'react-native'
import { SettingsScreen, useBrandTokens } from '@chiaro/officials-ui'

export default function PrivacyPolicy() {
  const { semantic } = useBrandTokens()
  return (
    <SettingsScreen title="Privacy Policy">
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
          Chiaro's full privacy policy is still being written. In the meantime, here's a short
          summary of what data we collect and why.
        </Text>
        <Text style={{ color: semantic.text.body, fontSize: 14, lineHeight: 20 }}>
          We store the email address you sign up with, the home address you calibrate to (to look up
          your elected officials), and the elected-officials pages you view. We don't sell your
          data, and we don't share it with advertisers.
        </Text>
        <Text style={{ color: semantic.text.muted, fontSize: 13, lineHeight: 18 }}>
          Last updated: placeholder. Full policy with contact information coming before public
          launch.
        </Text>
      </View>
    </SettingsScreen>
  )
}
