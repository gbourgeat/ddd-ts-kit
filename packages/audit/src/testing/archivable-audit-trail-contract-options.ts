import type { Awaitable } from '@ddd-ts-kit/testing/contracts';
import type { ArchivableAuditTrail } from '../archive/archivable-audit-trail';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';

export interface ArchivableAuditTrailContractOptions {
  readonly name: string;
  /** A fresh, empty trail that archives, with the default chains; called before each test. */
  createTrail(): Awaitable<AuditTrailUnderContract & ArchivableAuditTrail>;
  /**
   * Removes the entries of this chain from this sequence on, behind the back of the trail. When
   * absent, a chain cut at its tail is not checked against the head.
   */
  readonly cut?: (chain: string, fromSequence: number) => Awaitable<void>;
}
