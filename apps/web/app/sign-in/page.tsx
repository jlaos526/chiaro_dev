'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignInPage(): React.JSX.Element {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p>No account? <a href="/sign-up">Sign up</a></p>
    </main>
  )
}
