// Public surface of @chiaro/officials-ui. Re-exported component-by-component
// in subsequent tasks. See barrel additions in each task.

// Side-effect import: cross-package module augmentation for react-native AccessibilityProps.
import './types/react-native-augment.ts'

export { ChiaroClientProvider, useChiaroClient, type ChiaroClientProviderProps } from './client-context.tsx'

// Top-level leaf primitives (Task 5)
export { PartyBadge, type PartyBadgeProps } from './PartyBadge.tsx'
export { OfficialAvatar, type OfficialAvatarProps } from './OfficialAvatar.tsx'
export { OfficialMeta, type OfficialMetaProps } from './OfficialMeta.tsx'

// cards/* atoms (Task 5)
export { CardSubsection, type CardSubsectionProps } from './cards/CardSubsection.tsx'
export { ComingSoonCard, type ComingSoonCardProps, type ComingSoonCategory } from './cards/ComingSoonCard.tsx'
export { ComplianceIcon, type ComplianceIconProps } from './cards/ComplianceIcon.tsx'
export { DistrictBadge, type DistrictBadgeProps } from './cards/DistrictBadge.tsx'
export { EvidenceExpand, type EvidenceExpandProps } from './cards/EvidenceExpand.tsx'
export { MetricCardShell, type MetricCardShellProps } from './cards/MetricCardShell.tsx'
export { PillChevron, type PillChevronProps } from './cards/PillChevron.tsx'

// cards/AlignmentChip (Task 6 — accepts `onPress` callback so consumers wire
// platform-specific router navigation)
export { AlignmentChip, type AlignmentChipProps } from './cards/AlignmentChip.tsx'

// bio/* atoms (Task 6)
export { BioHeader, type BioHeaderProps } from './bio/BioHeader.tsx'
export { BioPortrait, type BioPortraitProps } from './bio/BioPortrait.tsx'
export { BioIdentityRow, type BioIdentityRowProps } from './bio/BioIdentityRow.tsx'
export { BioServiceCard, type BioServiceCardProps } from './bio/BioServiceCard.tsx'
export { BioContactLinks, type BioContactLinksProps } from './bio/BioContactLinks.tsx'
export { BioAlignmentChipRow, type BioAlignmentChipRowProps } from './bio/BioAlignmentChipRow.tsx'

// finance/* atoms (Task 6)
export { FinanceSubSectionHeading, type FinanceSubSectionHeadingProps } from './finance/FinanceSubSectionHeading.tsx'
export { FinanceSummaryStrip, type FinanceSummaryStripProps } from './finance/FinanceSummaryStrip.tsx'
export {
  TopAmountBreakdown,
  type TopAmountBreakdownProps,
  type TopAmountRow,
  type TopAmountNoun,
} from './finance/TopAmountBreakdown.tsx'

// federal/* lists (Task 8) — pure-display components, all data passed via props
export { FederalKPIList, type FederalKPIListProps } from './federal/FederalKPIList.tsx'
export { FederalLeadershipList, type FederalLeadershipListProps } from './federal/FederalLeadershipList.tsx'
export { FederalSponsoredBillsList, type FederalSponsoredBillsListProps } from './federal/FederalSponsoredBillsList.tsx'
export { FederalCosponsoredBillsList, type FederalCosponsoredBillsListProps } from './federal/FederalCosponsoredBillsList.tsx'
export {
  FederalMissedVotesList,
  type FederalMissedVotesListProps,
  type MissedVoteEntry,
} from './federal/FederalMissedVotesList.tsx'
export { FederalDonorsList, type FederalDonorsListProps } from './federal/FederalDonorsList.tsx'
export { FederalPACsList, type FederalPACsListProps } from './federal/FederalPACsList.tsx'
export {
  FederalScorecardRatingsList,
  type FederalScorecardRatingsListProps,
} from './federal/FederalScorecardRatingsList.tsx'
export {
  FederalDistrictOfficesList,
  type FederalDistrictOfficesListProps,
} from './federal/FederalDistrictOfficesList.tsx'
export {
  FederalTownHallsList,
  type FederalTownHallsListProps,
} from './federal/FederalTownHallsList.tsx'
export {
  FederalStockTransactionsList,
  type FederalStockTransactionsListProps,
} from './federal/FederalStockTransactionsList.tsx'
export {
  FederalHoldingsList,
  type FederalHoldingsListProps,
} from './federal/FederalHoldingsList.tsx'
export {
  FederalDisclosureOtherList,
  type FederalDisclosureOtherListProps,
} from './federal/FederalDisclosureOtherList.tsx'

// federal/* cards (Task 7) — composed wrappers that call hooks via
// useChiaroClient() and render the federal lists above.
export {
  FederalServiceRecordCard,
  type FederalServiceRecordCardProps,
} from './federal/FederalServiceRecordCard.tsx'
export {
  FederalVotingBillsCard,
  type FederalVotingBillsCardProps,
} from './federal/FederalVotingBillsCard.tsx'
export {
  FederalFinanceCard,
  type FederalFinanceCardProps,
} from './federal/FederalFinanceCard.tsx'
export {
  FederalIssuePositionsCard,
  type FederalIssuePositionsCardProps,
} from './federal/FederalIssuePositionsCard.tsx'
export {
  FederalCommunityPresenceCard,
  type FederalCommunityPresenceCardProps,
} from './federal/FederalCommunityPresenceCard.tsx'
export {
  FederalEthicsAccountabilityCard,
  type FederalEthicsAccountabilityCardProps,
} from './federal/FederalEthicsAccountabilityCard.tsx'

// state/* lists + evidence (Task 9) — pure-display props-based components
// for the lists; StateIssueVotesEvidence is the only Evidence that calls a
// hook via `useChiaroClient()` because subjects are derived inside.
export {
  StateBillsEvidence,
  type StateBillsEvidenceProps,
} from './state/StateBillsEvidence.tsx'
export {
  StateVotesEvidence,
  type StateVotesEvidenceProps,
} from './state/StateVotesEvidence.tsx'
export {
  StateDonorsEvidence,
  type StateDonorsEvidenceProps,
} from './state/StateDonorsEvidence.tsx'
export {
  StateIssueVotesEvidence,
  type StateIssueVotesEvidenceProps,
} from './state/StateIssueVotesEvidence.tsx'
export {
  StateCommitteeHearingsList,
  type StateCommitteeHearingsListProps,
} from './state/StateCommitteeHearingsList.tsx'
export {
  StateDistrictOfficesList,
  type StateDistrictOfficesListProps,
} from './state/StateDistrictOfficesList.tsx'
export {
  StateTownHallsList,
  type StateTownHallsListProps,
} from './state/StateTownHallsList.tsx'
export {
  StateEthicsComplaintsList,
  type StateEthicsComplaintsListProps,
} from './state/StateEthicsComplaintsList.tsx'
export {
  StateFinancialDisclosuresList,
  type StateFinancialDisclosuresListProps,
} from './state/StateFinancialDisclosuresList.tsx'
export {
  StateOfficialEventsList,
  type StateOfficialEventsListProps,
} from './state/StateOfficialEventsList.tsx'

// state/* cards (Task 10) — composed wrappers that call hooks via
// useChiaroClient() and render the state lists/evidence above.
export {
  StateServiceRecordCard,
  type StateServiceRecordCardProps,
} from './state/StateServiceRecordCard.tsx'
export {
  StateFinanceCard,
  type StateFinanceCardProps,
} from './state/StateFinanceCard.tsx'
export {
  StateIssuePositionsCard,
  type StateIssuePositionsCardProps,
} from './state/StateIssuePositionsCard.tsx'
export {
  StateCommunityPresenceCard,
  type StateCommunityPresenceCardProps,
} from './state/StateCommunityPresenceCard.tsx'
export {
  StateConductCard,
  type StateConductCardProps,
} from './state/StateConductCard.tsx'
export {
  StateFinancialActivityCard,
  type StateFinancialActivityCardProps,
} from './state/StateFinancialActivityCard.tsx'
export {
  StateOfficialDetailPage,
  type StateOfficialDetailPageProps,
} from './state/StateOfficialDetailPage.tsx'

// Nav components (Task 11) — callback-based, no router imports
export {
  OfficialsCard,
  type OfficialsCardProps,
  type OfficialsCardSelectTarget,
} from './OfficialsCard.tsx'
export {
  OfficialsList,
  type OfficialsListProps,
} from './OfficialsList.tsx'
export {
  StateOfficialsCardSection,
  type StateOfficialsCardSectionProps,
} from './state/StateOfficialsCardSection.tsx'

// Slice 39 — generic input primitives
export { BrandTextInput, type BrandTextInputProps } from './inputs/BrandTextInput.tsx'

// auth/* primitives (slice 31) — leaf components for the auth screens
export { AuthWordmark, type AuthWordmarkProps } from './auth/AuthWordmark.tsx'
export { AuthCrossLink, type AuthCrossLinkProps } from './auth/AuthCrossLink.tsx'
export { AuthInput, type AuthInputProps } from './auth/AuthInput.tsx'
export { AuthForm, type AuthFormProps } from './auth/AuthForm.tsx'
export { AuthScreen, type AuthScreenProps } from './auth/AuthScreen.tsx'
export { AuthPageChrome, type AuthPageChromeProps } from './auth/AuthPageChrome.tsx'

// Slice 33 — brand retrofit
export { Logo, type LogoProps } from './Logo.tsx'
export {
  BrandModeOverrideContext,
  useBrandTokens,
  useMapColors,
  type BrandTokens,
} from './brand-hooks.ts'

// Slice 38 — dark mode toggle
export {
  BrandModeProvider,
  useBrandModeSetter,
  type BrandModeProviderProps,
} from './brand-mode-provider.tsx'
export { BrandModeThemeRow } from './settings/brand-mode-theme-row.tsx'

// Slice 39 — settings architecture
export { SettingsRow, type SettingsRowProps } from './settings/SettingsRow.tsx'
export { SettingsScreen, type SettingsScreenProps } from './settings/SettingsScreen.tsx'
export { SettingsSection, type SettingsSectionProps } from './settings/SettingsSection.tsx'
export { SettingsNavRow, type SettingsNavRowProps } from './settings/SettingsNavRow.tsx'
export { SettingsActionRow, type SettingsActionRowProps } from './settings/SettingsActionRow.tsx'
export { SettingsToggleRow, type SettingsToggleRowProps } from './settings/SettingsToggleRow.tsx'
export { SettingsValueRow, type SettingsValueRowProps } from './settings/SettingsValueRow.tsx'
export { SettingsComingSoonRow, type SettingsComingSoonRowProps } from './settings/SettingsComingSoonRow.tsx'

// Slice 39 — calibrate
export { CalibrateScreen, type CalibrateScreenProps } from './calibrate/CalibrateScreen.tsx'

// Slice 47 — generic page shells
export { BrandPageScreen, type BrandPageScreenProps } from './screens/BrandPageScreen.tsx'
export { BrandFormScreen, type BrandFormScreenProps } from './screens/BrandFormScreen.tsx'

// Slice 47 — nav helpers
export { signOut, type SignOutRouter } from './nav/sign-out.ts'
export { BrandNavRail, type BrandNavRailProps, type RailUser } from './nav/BrandNavRail.tsx'
export { BrandNavRailMount } from './nav/BrandNavRailMount.tsx'
export { useBreakpoint } from './nav/useBreakpoint.ts'

// Slice 48 — nav components
// BrandNavRailBody is cross-platform (no expo-router deps — safe for web bundle)
export { BrandNavRailBody, type BrandNavRailBodyProps, type RailRouteKey } from './nav/BrandNavRailBody.tsx'
// BackButton, BrandDrawer, BrandDrawerContent import expo-router or expo-router/drawer
// + @react-navigation/drawer which are mobile-only and cannot be bundled by Next.js/webpack.
// Mobile consumers import them directly from source:
//   import { BackButton } from '@chiaro/officials-ui/src/nav/BackButton.tsx'
//   import { BrandDrawer } from '@chiaro/officials-ui/src/nav/BrandDrawer.tsx'
//   import { BrandDrawerContent } from '@chiaro/officials-ui/src/nav/BrandDrawerContent.tsx'

// Slice 45 — brand primitives. Foundational components for page composition
// (Heading, BodyText, Button, Link, Alert). Mode-aware via useBrandTokens().
// Used by slice 47+ to rewrite F1/F2 surfaces (per slice 44 UI audit).
export { BrandButton, type BrandButtonProps } from './primitives/BrandButton.tsx'
export { BrandHeading, type BrandHeadingProps } from './primitives/BrandHeading.tsx'
export { BrandBodyText, type BrandBodyTextProps } from './primitives/BrandBodyText.tsx'
export { BrandLink, type BrandLinkProps } from './primitives/BrandLink.tsx'
export {
  BrandAlert,
  type BrandAlertProps,
  type BrandAlertSeverity,
} from './primitives/BrandAlert.tsx'

// Slice 52 — issue-priorities onboarding flow. The per-platform route (T19/T21)
// mounts <IssueFlowProvider> once and renders each step screen by `step`.
export {
  IssueFlowProvider,
  useIssueFlow,
  MAX_TOPICS,
  type IssueFlowProviderProps,
  type IssueFlowState,
} from './issues/IssueFlowProvider.tsx'
export { IssueWelcomeScreen, QUICK_START_PRESETS, type IssueWelcomeScreenProps } from './issues/IssueWelcomeScreen.tsx'
export { TopicPickerScreen, type TopicPickerScreenProps } from './issues/TopicPickerScreen.tsx'
export { LensPickerScreen, type LensPickerScreenProps } from './issues/LensPickerScreen.tsx'
export { IssueQuizScreen, type IssueQuizScreenProps } from './issues/IssueQuizScreen.tsx'
export {
  IssueRadarResultScreen,
  type IssueRadarResultScreenProps,
} from './issues/IssueRadarResultScreen.tsx'
export { MyIssuesCard, type MyIssuesCardProps } from './issues/MyIssuesCard.tsx'
export { IssueRadarChart, type IssueRadarChartProps } from './issues/IssueRadarChart.tsx'
export { IssueRadarOverlay, type IssueRadarOverlayProps } from './issues/IssueRadarOverlay.tsx'
export { RepAlignmentStrip, type RepAlignmentStripProps } from './issues/RepAlignmentStrip.tsx'
export { RepAlignmentSection, type RepAlignmentSectionProps } from './issues/RepAlignmentSection.tsx'
export { IssuePriorityTag, type IssuePriorityTagProps } from './issues/IssuePriorityTag.tsx'
