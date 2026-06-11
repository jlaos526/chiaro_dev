import { render } from '@testing-library/react-native'

// Route handler test for apps/mobile/app/(auth)/sign-up.tsx. Mirrors the
// calibrate.test.tsx pattern: the page's handleSubmit is an internal closure,
// so we mock @chiaro/officials-ui's AuthScreen to a no-render component that
// CAPTURES onSubmit, render <SignUp/>, then invoke the captured callback.
// Audit U6: the email-confirmation path must resolve with the { notice }
// channel (slice 61 E8), NOT throw (which rendered the red error banner).
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11).

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const mockSignUp = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => mockSignUp(...args) } },
}))

type AuthScreenProps = {
  onSubmit: (vals: { email: string; password: string }) => Promise<void | { notice: string }>
}
let captured: AuthScreenProps | null = null
jest.mock('@chiaro/officials-ui', () => ({
  AuthScreen: (props: AuthScreenProps) => {
    captured = props
    return null
  },
}))

import SignUp from '../app/(auth)/sign-up'

function mountAndCapture(): AuthScreenProps {
  captured = null
  render(<SignUp />)
  if (!captured) throw new Error('AuthScreen props were not captured')
  return captured
}

describe('mobile /sign-up handleSubmit', () => {
  beforeEach(() => {
    mockSignUp.mockReset()
  })

  it('resolves with the check-email notice (not a throw) when no session is returned (audit U6)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    const { onSubmit } = mountAndCapture()
    await expect(onSubmit({ email: 'ada@example.com', password: 'longenough' })).resolves.toEqual({
      notice: 'Check your email to confirm your account.',
    })
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'longenough' })
  })

  it('throws the supabase error message on sign-up failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    })
    const { onSubmit } = mountAndCapture()
    await expect(onSubmit({ email: 'ada@example.com', password: 'longenough' })).rejects.toThrow(
      'User already registered',
    )
  })

  it('resolves silently (no notice) when a session is returned', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
    const { onSubmit } = mountAndCapture()
    await expect(onSubmit({ email: 'ada@example.com', password: 'longenough' })).resolves.toBeUndefined()
  })
})
