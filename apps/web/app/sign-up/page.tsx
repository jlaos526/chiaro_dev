'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthScreen, AuthPageChrome } from '@chiaro/officials-ui'

export default function SignUpPage(): React.JSX.Element {
  const router = useRouter()

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    if (!data.session) {
      // Email confirmation required (production); surface via the neutral notice
      // channel (not the red error banner — this is the happy path).
      return { notice: 'Check your email to confirm your account.' }
    }
    router.push('/')
    router.refresh()
  }

  // Slice 79.5 (demo readiness): a lost confirmation email otherwise bricks
  // the account — no password-reset flow exists yet (named follow-up).
  async function handleResend(email: string) {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw new Error(error.message)
  }

  function goToSignIn() {
    router.push('/sign-in')
  }

  return (
    <>
      <AuthPageChrome rightCrossLink={{ mode: 'sign-in', href: '/sign-in', onPress: goToSignIn }} />
      <AuthScreen
        mode="sign-up"
        onSubmit={handleSubmit}
        onResend={handleResend}
        onCrossLinkPress={goToSignIn}
        crossLinkHref="/sign-in"
        showBranding={false}
      />
    </>
  )
}
