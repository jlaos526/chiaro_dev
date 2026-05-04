'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignUpPage(): React.JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      // Email confirmation required (production); placeholder UI
      setError('Check your email to confirm your account.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password <input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing up…' : 'Sign up'}</button>
      </form>
      <p>Have an account? <a href="/sign-in">Sign in</a></p>
    </main>
  )
}
