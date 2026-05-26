import { useRouter } from 'expo-router'
import { AuthScreen } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

export default function SignUp() {
  const router = useRouter()

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    if (!data.session) {
      throw new Error('Check your email to confirm your account.')
    }
    // expo-router auth guard at root layout handles post-auth redirect
  }

  return (
    <AuthScreen
      mode="sign-up"
      onSubmit={handleSubmit}
      onCrossLinkPress={() => router.push('/(auth)/sign-in')}
      showBranding
    />
  )
}
