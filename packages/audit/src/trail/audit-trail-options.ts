import type { AuditRecord } from '@ddd-ts-kit/kernel';
import type { SealingOptions } from '../chain/sealing-options';

export interface AuditTrailOptions {
  /** The chain an entry is appended to. Default `chainOfTenant`. */
  readonly chainOf?: (record: AuditRecord) => string;

  readonly sealing?: SealingOptions;
}
