'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthScreen, AuthPageChrome } from '@chiaro/officials-ui'

export default function SignInPage(): React.JSX.Element {
  const router = useRouter()

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    router.push('/')
    router.refresh()
  }

  function goToSignUp() {
    router.push('/sign-up')
  }

  return (
    <>
      <AuthPageChrome rightCrossLink={{ mode: 'sign-up', href: '/sign-up', onPress: goToSignUp }} />
      <AuthScreen
        mode="sign-in"
        onSubmit={handleSubmit}
        onCrossLinkPress={goToSignUp}
        crossLinkHref="/sign-up"
        showBranding={false}
      />
    </>
  )
}
