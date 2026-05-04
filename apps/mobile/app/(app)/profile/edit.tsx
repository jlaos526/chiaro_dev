import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'

export default function ProfileEdit() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '))
      return
    }
    setLoading(true)
    try {
      await updateMyProfile(supabase, parsed.data)
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20 }}>Complete your profile</Text>
      <Text>Display name</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} />
      <Text>Username</Text>
      <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title={loading ? 'Saving…' : 'Save'} onPress={onSubmit} disabled={loading} />
    </View>
  )
}
