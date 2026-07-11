import type { PostgrestError } from '@supabase/supabase-js'

export class ProfileError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProfileError'
  }
}

export function mapProfileError(error: PostgrestError): ProfileError {
  if (error.code === '23505' && error.message.toLowerCase().includes('username')) {
    return new ProfileError('Username taken', error)
  }
  return new ProfileError(error.message, error)
}
