'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IssueFlowProvider,
  IssueWelcomeScreen,
  TopicPickerScreen,
  LensPickerScreen,
  IssueQuizScreen,
  IssueRadarResultScreen,
  useChiaroClient,
} from '@chiaro/officials-ui'
import { useIssueCatalog, useMySelections, useSaveSelections } from '@chiaro/issues'

type Step = 'welcome' | 'topics' | 'lenses' | 'quiz' | 'radar'

/**
 * The issue-priorities flow as a single stepper route (plan Phase 4 refinement):
 * `IssueFlowProvider` holds wizard state so it survives step changes without
 * cross-route plumbing. Entry points across the app deep-link to `/issues`.
 */
export default function IssuesPage(): React.JSX.Element {
  const router = useRouter()
  const client = useChiaroClient()
  const { data: catalog = [] } = useIssueCatalog(client)
  const { data: existing } = useMySelections(client)
  const save = useSaveSelections(client)
  const [step, setStep] = useState<Step>('welcome')

  return (
    <IssueFlowProvider initialSelections={existing ?? null}>
      {step === 'welcome' && (
        <IssueWelcomeScreen catalog={catalog} onStart={() => setStep('topics')} />
      )}
      {step === 'topics' && (
        <TopicPickerScreen topics={catalog} onNext={() => setStep('lenses')} />
      )}
      {step === 'lenses' && (
        <LensPickerScreen catalog={catalog} onNext={() => setStep('quiz')} />
      )}
      {step === 'quiz' && (
        <IssueQuizScreen catalog={catalog} onFinish={() => setStep('radar')} />
      )}
      {step === 'radar' && (
        <IssueRadarResultScreen
          catalog={catalog}
          onSave={async (payload) => {
            await save.mutateAsync(payload)
            router.push('/')
          }}
        />
      )}
    </IssueFlowProvider>
  )
}
