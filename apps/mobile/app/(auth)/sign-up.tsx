import { useRouter } from 'expo-router'
import { AuthScreen } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

export default function SignUp() {
  const router = useRouter()

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    if (!data.session) {
      // Email confirmation required (production); surface via the neutral
      // notice channel (slice 61 E8) — this is the happy path, not an error
      // (audit U6). Mirrors apps/web/app/sign-up/page.tsx.
      return { notice: 'Check your email to confirm your account.' }
    }
    // expo-router auth guard at root layout handles post-auth redirect
    return undefined
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
