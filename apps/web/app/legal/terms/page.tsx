'use client'

import { LegalBody, SettingsScreen, TERMS_COPY } from '@chiaro/officials-ui'

export default function TermsOfService() {
  return (
    <SettingsScreen title="Terms of Service">
      <LegalBody copy={TERMS_COPY} />
    </SettingsScreen>
  )
}
