import type { PtrAdapter } from '../shared/types.ts'
import { houseEfdPtr }    from './house-efd.ts'
import { senateEfpfdPtr } from './senate-efpfd.ts'

/**
 * PTR adapters dispatch array (slice 26 Task 3).
 *
 * Consumed by federal-ptrs-ingest.ts orchestrator. Filtered per --chamber
 * CLI flag via slug prefix (`house-` / `senate-`).
 */
export const PTR_ADAPTERS: PtrAdapter[] = [houseEfdPtr, senateEfpfdPtr]
