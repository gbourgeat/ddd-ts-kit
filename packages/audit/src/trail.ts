import type { AuditRecord } from '@ddd-ts-kit/kernel';
import type { SealingOptions } from './chain.js';

export type { AuditFilter, AuditReader, AuditSortField, AuditTrail } from '@ddd-ts-kit/kernel';

export interface AuditTrailOptions {
  /** The chain an entry is appended to. Default `chainOfTenant`. */
  readonly chainOf?: (record: AuditRecord) => string;
  readonly sealing?: SealingOptions;
}
