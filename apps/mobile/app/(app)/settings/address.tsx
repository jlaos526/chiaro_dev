import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { addressInputSchema, getMyLocation } from '@chiaro/location'

export default function EditAddressScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function save() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) return setError('Enter a complete address.')
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('Address not found.')
      else if (status === 502) setError('Service unavailable. Try again.')
      else setError('Could not save.')
      return
    }
    router.back()
  }

  if (bootstrapping) return <Text>Loading…</Text>

  return (
    <View style={styles.root}>
      {calibratedAt && <Text style={styles.meta}>Last updated {new Date(calibratedAt).toLocaleString()}</Text>}
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />
      {error && <Text role="alert" style={styles.err}>{error}</Text>}
      <Pressable style={styles.btn} onPress={save} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  input: { borderWidth: 1, borderColor: '#888', padding: 10, borderRadius: 4 },
  btn: { backgroundColor: '#5b6cff', padding: 12, borderRadius: 4 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  meta: { color: '#666' },
  err: { color: '#d85c5c' },
})
