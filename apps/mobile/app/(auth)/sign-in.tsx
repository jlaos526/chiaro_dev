import { useRouter } from 'expo-router'
import { AuthScreen } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

export default function SignIn() {
  const router = useRouter()

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // expo-router auth guard at root layout handles post-auth redirect
  }

  return (
    <AuthScreen
      mode="sign-in"
      onSubmit={handleSubmit}
      onCrossLinkPress={() => router.push('/(auth)/sign-up')}
      showBranding
    />
  )
}
