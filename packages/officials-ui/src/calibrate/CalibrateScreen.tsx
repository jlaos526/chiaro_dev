'use client'

import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { NativeFormShell } from '../screens/_native-form-shell.tsx'
import { BrandTextInput } from '../inputs/BrandTextInput.tsx'

export interface CalibrateScreenProps {
  title?: string
  description?: string
  initialAddress?: string
  onSubmit: (address: string) => Promise<void>
  onSkip?: () => void
  /** When provided, renders a brand-outlined "Use my current location" button
   *  above the address input. Handler is responsible for requesting
   *  permission + reading coords + submitting them to the backend; throws on
   *  failure for friendly error display. Mobile-only in practice; web doesn't
   *  pass this prop. */
  onGpsSubmit?: () => Promise<void>
  submitLabel?: string
  loadingLabel?: string
  gpsLabel?: string
  gpsLoadingLabel?: string
}

export function CalibrateScreen({
  title = 'Set your home location',
  description = "We'll use this to show you the elected officials representing your address.",
  initialAddress = '',
  onSubmit,
  onSkip,
  onGpsSubmit,
  submitLabel = 'Calibrate',
  loadingLabel = 'Calibrating…',
  gpsLabel = 'Use my current location',
  gpsLoadingLabel = 'Getting location…',
}: CalibrateScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const [address, setAddress] = useState(initialAddress)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      await onSubmit(address)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGps() {
    if (!onGpsSubmit) return
    setError(null)
    setLoading(true)
    try {
      await onGpsSubmit()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.')
    } finally {
      setLoading(false)
    }
  }

  const card = (
    <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
      <Text style={[styles.title, { color: semantic.text.primary }]}>{title}</Text>
      <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
      {onGpsSubmit ? (
        <Pressable
          onPress={loading ? undefined : handleGps}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          aria-disabled={loading}
          style={[styles.gpsButton, { borderColor: semantic.accent.primary, opacity: loading ? 0.6 : 1 }]}
        >
          <Text style={[styles.gpsButtonText, { color: semantic.accent.primary }]}>
            {loading ? gpsLoadingLabel : gpsLabel}
          </Text>
        </Pressable>
      ) : null}
      <BrandTextInput
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Brooklyn, NY 11201"
      />
      {error ? (
        <Text role="alert" style={[styles.error, { color: semantic.alert.danger.fg }]}>{error}</Text>
      ) : null}
      <Pressable
        onPress={loading ? undefined : handleSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        aria-disabled={loading}
        style={[styles.cta, { backgroundColor: semantic.accent.primary, opacity: loading ? 0.6 : 1 }]}
      >
        <Text style={[styles.ctaText, { color: semantic.text.onAccent }]}>
          {loading ? loadingLabel : submitLabel}
        </Text>
      </Pressable>
      {onSkip ? (
        <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
          <Text style={[styles.skipText, { color: semantic.text.muted }]}>Skip for now</Text>
        </Pressable>
      ) : null}
    </View>
  )

  // Native: scroll + keyboard avoidance for the centered card (audit U0/C8
  // + U5). Web keeps the plain-View path byte-identical below.
  if (Platform.OS !== 'web') {
    return <NativeFormShell backgroundColor={semantic.bg.app}>{card}</NativeFormShell>
  }

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      {card}
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13 },
  cta: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '600' },
  gpsButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  gpsButtonText: { fontSize: 15, fontWeight: '600' },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14 },
})
