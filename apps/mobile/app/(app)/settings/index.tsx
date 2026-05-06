import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    await AsyncStorage.removeItem('chiaro_skip_calibrate')
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }
  return (
    <View style={styles.root}>
      <Link href="/settings/address" style={styles.row}><Text>Home address ›</Text></Link>
      <Pressable style={styles.row} onPress={handleSignOut}><Text>Sign out</Text></Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  row: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#aaa' },
})
