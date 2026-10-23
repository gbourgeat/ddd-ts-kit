import type { AuditOutcome } from '@ddd-ts-kit/audit';

/** What an entry of the trail may end with, as the contract lists it. */
export const auditOutcomes = ['allowed', 'denied', 'succeeded', 'failed'] as const satisfies readonly AuditOutcome[];
