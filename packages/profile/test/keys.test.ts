import { describe, expect, it } from 'vitest'
import { profileKeys } from '../src/keys.ts'

describe('profileKeys', () => {
  it('exposes the all root', () => {
    expect(profileKeys.all).toEqual(['profile'])
  })

  it('me() is under all', () => {
    expect(profileKeys.me()).toEqual(['profile', 'me'])
  })

  it('keys are stable across invocations', () => {
    expect(profileKeys.me()).toEqual(profileKeys.me())
  })
})
