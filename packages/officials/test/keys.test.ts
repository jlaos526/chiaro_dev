import { describe, expect, it } from 'vitest'
import { officialsKeys } from '../src/keys.ts'

describe('officialsKeys', () => {
  it('exposes the all root', () => {
    expect(officialsKeys.all).toEqual(['officials'])
  })

  it('lists() is under all', () => {
    expect(officialsKeys.lists()).toEqual(['officials', 'list'])
  })

  it('myList is under lists', () => {
    expect(officialsKeys.myList()).toEqual(['officials', 'list', 'mine'])
  })

  it('detail(id) is under all', () => {
    expect(officialsKeys.detail('abc')).toEqual(['officials', 'detail', 'abc'])
  })

  it('keys are stable across invocations', () => {
    expect(officialsKeys.detail('abc')).toEqual(officialsKeys.detail('abc'))
  })
})
