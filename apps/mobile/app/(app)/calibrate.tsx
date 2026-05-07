import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { addressInputSchema } from '@chiaro/location'
import { getCurrentLocation } from '@/lib/location-permissions'

export default function CalibrateScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitAddress() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) return setError('Enter a complete address (street, city, state, ZIP).')
    await runCalibration({ address: parsed.data.address })
  }

  async function submitGps() {
    setError(null)
    setLoading(true)
    const r = await getCurrentLocation()
    if (!r.ok) {
      setLoading(false)
      return setError(r.message)
    }
    await runCalibration({ lat: r.lat, lng: r.lng })
  }

  async function runCalibration(body: { address: string } | { lat: number; lng: number }) {
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', { body })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('We couldn\'t find that address. Double-check spelling.')
      else if (status === 422) setError('We can\'t resolve districts for that location yet.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Something went wrong. Try again.')
      return
    }
    router.replace('/')
  }

  async function skip() {
    await AsyncStorage.setItem('chiaro_skip_calibrate', '1')
    router.replace('/')
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Set your home location</Text>
      <Text>We'll show the elected officials representing this address.</Text>

      <Pressable style={styles.gpsBtn} onPress={submitGps} disabled={loading}>
        <Text style={styles.gpsBtnText}>Use my current location</Text>
      </Pressable>

      <Text style={styles.or}>— or —</Text>

      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Brooklyn, NY 11201"
        autoCapitalize="words"
        autoCorrect={false}
      />
      <Pressable style={styles.submitBtn} onPress={submitAddress} disabled={loading}>
        <Text style={styles.submitBtnText}>{loading ? 'Calibrating…' : 'Calibrate'}</Text>
      </Pressable>

      {error && <Text role="alert" style={styles.err}>{error}</Text>}

      <Pressable onPress={skip} style={styles.skip}>
        <Text>Skip for now</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#888', padding: 10, borderRadius: 4 },
  gpsBtn: { backgroundColor: '#1f9b88', padding: 12, borderRadius: 4 },
  gpsBtnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  submitBtn: { backgroundColor: '#5b6cff', padding: 12, borderRadius: 4 },
  submitBtnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  or: { textAlign: 'center', color: '#888' },
  err: { color: '#d85c5c' },
  skip: { padding: 12, alignItems: 'center' },
})
