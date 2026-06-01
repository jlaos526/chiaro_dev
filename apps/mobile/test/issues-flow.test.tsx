import { render, fireEvent, screen } from '@testing-library/react-native'

// Route orchestration test: the shared @chiaro/officials-ui flow screens are
// exercised in the officials-ui package (vitest + RNW). Here we mock them to
// thin buttons that fire their nav callbacks, so this asserts ONLY the route's
// stepper wiring (welcome → topics → lenses → quiz → radar → save → home).
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11).

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))
jest.mock('expo-router/drawer', () => ({ Drawer: { Screen: () => null } }))
jest.mock('@chiaro/officials-ui/src/nav/BackButton.tsx', () => ({ BackButton: () => null }))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))

const mockMutateAsync = jest.fn().mockResolvedValue(undefined)
jest.mock('@chiaro/issues', () => ({
  useIssueCatalog: () => ({ data: [] }),
  useMySelections: () => ({ data: [] }),
  useSaveSelections: () => ({ mutateAsync: mockMutateAsync }),
}))

jest.mock('@chiaro/officials-ui', () => {
  const React = require('react')
  const { Text, Pressable } = require('react-native')
  const btn = (label: string, onPress: () => void) =>
    React.createElement(Pressable, { onPress }, React.createElement(Text, null, label))
  return {
    IssueFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    IssueWelcomeScreen: ({ onStart }: { onStart: () => void }) => btn('Get started', onStart),
    TopicPickerScreen: ({ onNext }: { onNext: () => void }) => btn('Topics step', onNext),
    LensPickerScreen: ({ onNext }: { onNext: () => void }) => btn('Lenses step', onNext),
    IssueQuizScreen: ({ onFinish }: { onFinish: () => void }) => btn('Quiz step', onFinish),
    IssueRadarResultScreen: ({ onSave }: { onSave: (p: unknown[]) => void }) =>
      btn('Save', () => onSave([])),
  }
})

import IssuesScreen from '../app/(app)/issues'

describe('mobile /issues stepper', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockMutateAsync.mockClear()
  })

  it('advances from welcome to topics', () => {
    render(<IssuesScreen />)
    fireEvent.press(screen.getByText('Get started'))
    expect(screen.getByText('Topics step')).toBeTruthy()
  })

  it('walks the full flow and saves, then returns home', async () => {
    render(<IssuesScreen />)
    fireEvent.press(screen.getByText('Get started'))
    fireEvent.press(screen.getByText('Topics step'))
    fireEvent.press(screen.getByText('Lenses step'))
    fireEvent.press(screen.getByText('Quiz step'))
    fireEvent.press(screen.getByText('Save'))
    expect(mockMutateAsync).toHaveBeenCalledWith([])
    // router.replace('/') runs after the awaited save resolves.
    await Promise.resolve()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
