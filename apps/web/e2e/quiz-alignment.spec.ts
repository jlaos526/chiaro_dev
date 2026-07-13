// Slice 83 (audit U8) — journey 3: issue-priorities flow (topic → lens →
// quiz → save) → the rep detail page shows the personalized alignment strip
// instead of the setup CTA.
import { expect, test } from '@playwright/test'
import { signUpAndCalibrate } from './helpers'

test('quiz save → rep page shows alignment strip', async ({ page }) => {
  await signUpAndCalibrate(page, 'quiz')

  // Direct route — the S79.5 nav entry is unit-covered; 'Issue priorities'
  // as a text selector is ambiguous on home (the MyIssuesCard heading
  // substring-matches it).
  await page.goto('/issues')
  await page.getByText('Get started').click()

  // Topic step: pick the first catalog topic card, then continue. The
  // seeded catalog (seed:issue-catalog) provides 13 topics.
  await page.getByTestId('issue-topic-option').first().click()
  await page.getByText('Continue', { exact: true }).click()

  // Lens step: first lens, continue.
  await page.getByTestId('issue-lens-option').first().click()
  await page.getByText('Continue', { exact: true }).click()

  // Quiz: all questions render at once; each answer button's accessible
  // name is "Agree: <question>". Answer every question, then the radar CTA
  // enables.
  const agreeButtons = page.getByRole('button', { name: /^Agree:/ })
  const questionCount = await agreeButtons.count()
  for (let i = 0; i < questionCount; i++) {
    await agreeButtons.nth(i).click()
  }
  await page.getByRole('button', { name: 'See my radar' }).click()
  await page.getByRole('button', { name: 'Save your issue priorities' }).click()

  // Back to the rep: the strip replaces the setup CTA once selections exist.
  await page.goto('/')
  await page.getByText('Harper Housefixture').first().click()
  await page.waitForURL(/\/officials\//, { timeout: 20_000 })
  await expect(page.getByText(/% aligned|no comparable record/i)).toBeVisible({ timeout: 20_000 })

  await page.screenshot({ path: 'e2e-artifacts/quiz-alignment.png', fullPage: true })
})
