import { describe, it, expect } from 'vitest'
import { profileFormSchema } from '../src/schema.ts'

describe('profileFormSchema', () => {
  it('accepts valid input and lowercases the username', () => {
    const result = profileFormSchema.parse({
      display_name: 'Alice',
      username: 'AliceCool_99',
    })
    expect(result.display_name).toBe('Alice')
    expect(result.username).toBe('alicecool_99')
  })

  it('rejects empty display_name', () => {
    expect(() => profileFormSchema.parse({ display_name: '', username: 'alice' })).toThrow()
  })

  it('rejects too-long display_name (>50)', () => {
    expect(() => profileFormSchema.parse({
      display_name: 'a'.repeat(51),
      username: 'alice',
    })).toThrow()
  })

  it('rejects username with disallowed characters', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'alice!' })).toThrow()
  })

  it('rejects username shorter than 3', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'al' })).toThrow()
  })

  it('rejects username longer than 20', () => {
    expect(() => profileFormSchema.parse({ display_name: 'Alice', username: 'a'.repeat(21) })).toThrow()
  })
})
