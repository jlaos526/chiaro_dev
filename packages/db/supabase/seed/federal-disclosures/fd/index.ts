import type { FdAdapter } from '../shared/types.ts'
import { houseEfdFd } from './house-efd.ts'
import { senateEfpfdFd } from './senate-efpfd.ts'

/**
 * FD adapters dispatch array (slice 26 Task 4).
 *
 * Consumed by federal-fds-ingest.ts orchestrator. Filtered per --chamber
 * CLI flag via slug prefix (`house-` / `senate-`).
 */
export const FD_ADAPTERS: FdAdapter[] = [houseEfdFd, senateEfpfdFd]
