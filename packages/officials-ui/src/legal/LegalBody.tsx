import { Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Slice 79.5 (demo readiness): honest shared legal copy for the
 * portfolio-demonstration deployment, replacing the slice-39c "placeholder"
 * text (which also falsely promised account deletion — S73 is parked). One
 * module keeps the 4 screens (web + mobile × privacy + terms) from drifting.
 * Real commercial-grade policies remain pre-public-launch work.
 */
export interface LegalCopy {
  paragraphs: string[]
  footer: string
}

export const PRIVACY_COPY: LegalCopy = {
  paragraphs: [
    'Chiaro is a personal portfolio demonstration project, not a commercial service. This page describes what the demo actually stores.',
    'If you create an account, Supabase Auth stores your email address and a hashed password. If you calibrate a location, the address text you enter is geocoded via Geocodio and stored with your account as a point plus the matched legislative districts — if you are just exploring, use the "sample address" option on the calibrate screen instead of a real residence. Optional profile fields (display name, username) and any issue-topic selections or quiz answers you save are also stored with your account to compute alignment views.',
    'Error monitoring uses Sentry; address text and issue selections are scrubbed from error reports before they leave the app. Data is processed by the hosting and tooling providers named here (Supabase, Vercel, Geocodio, Sentry) and nobody else. Nothing is sold, shared with advertisers, or used for profiling.',
    'Because this is a demo environment, data may be reset or deleted at any time without notice. To have your account removed, open an issue on the project repository.',
  ],
  footer: 'Last updated: July 12, 2026. A full policy ships before any public launch.',
}

export const TERMS_COPY: LegalCopy = {
  paragraphs: [
    'Chiaro is a personal portfolio demonstration project provided as-is, with no warranty and no guarantee of availability — the environment may pause, reset, or lose data at any time.',
    'Elected-official records shown here are aggregated from public sources (Congress.gov, OpenStates, state legislature and ethics/finance sites) and may be incomplete, outdated, or wrong. Nothing in this app is legal or voting advice; verify anything that matters against official sources.',
    'Use the demo in good faith: no scraping, load testing, or attempts to access other users’ data. Demo accounts may be removed at any time as part of environment resets.',
  ],
  footer: 'Last updated: July 12, 2026. Full terms ship before any public launch.',
}

export function LegalBody({ copy }: { copy: LegalCopy }): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
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
      {copy.paragraphs.map((p) => (
        <Text
          key={p.slice(0, 32)}
          style={{ color: semantic.text.body, fontSize: 14, lineHeight: 20 }}
        >
          {p}
        </Text>
      ))}
      <Text style={{ color: semantic.text.muted, fontSize: 13, lineHeight: 18 }}>
        {copy.footer}
      </Text>
    </View>
  )
}
