import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Text>Password (min 8)</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title={loading ? 'Signing up…' : 'Sign up'} onPress={onSubmit} disabled={loading} />
      <Link href="/(auth)/sign-in">Have an account? Sign in</Link>
    </View>
  )
}
