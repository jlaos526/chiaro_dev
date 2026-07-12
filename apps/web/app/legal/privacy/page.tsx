'use client'

import { LegalBody, PRIVACY_COPY, SettingsScreen } from '@chiaro/officials-ui'

export default function PrivacyPolicy() {
  return (
    <SettingsScreen title="Privacy Policy">
      <LegalBody copy={PRIVACY_COPY} />
    </SettingsScreen>
  )
}
