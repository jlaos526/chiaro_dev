import { Drawer } from 'expo-router/drawer'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import {
  IssueFlowProvider,
  IssueWelcomeScreen,
  TopicPickerScreen,
  LensPickerScreen,
  IssueQuizScreen,
  IssueRadarResultScreen,
} from '@chiaro/officials-ui'
import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'
import { useIssueCatalog, useMySelections, useSaveSelections } from '@chiaro/issues'
import { supabase } from '@/lib/supabase'

type Step = 'welcome' | 'topics' | 'lenses' | 'quiz' | 'radar'

/**
 * The issue-priorities flow as a single Expo Router stepper screen (mirrors the
 * web `/issues` route). `IssueFlowProvider` holds wizard state across steps; the
 * shared @chiaro/officials-ui screens are the same ones the web route mounts.
 * Saving persists via `useSaveSelections` then returns home.
 */
export default function IssuesScreen(): React.JSX.Element {
  const router = useRouter()
  const { data: catalog = [] } = useIssueCatalog(supabase)
  const { data: existing } = useMySelections(supabase)
  const save = useSaveSelections(supabase)
  const [step, setStep] = useState<Step>('welcome')

  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Issue priorities',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
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
              router.replace('/')
            }}
          />
        )}
      </IssueFlowProvider>
    </>
  )
}
