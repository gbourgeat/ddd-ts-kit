import type { AuditEntry } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '@ddd-ts-kit/testing/contracts';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';

export interface AuditTrailContractOptions {
  readonly name: string;
  /** A fresh, empty trail with the default chains (one per tenant, `global` otherwise); called before each test. */
  createTrail(): Awaitable<AuditTrailUnderContract>;
  /**
   * Rewrites the stored `action` of this entry behind the back of the trail, the way somebody
   * with access to the storage would. When absent, tampering is only checked on what was read.
   */
  readonly tamper?: (entry: AuditEntry, action: string) => Awaitable<void>;
  /**
   * Removes the entries of this chain from this sequence on, behind the back of the trail. When
   * absent, a chain cut at its tail is only checked on what was read.
   */
  readonly cut?: (chain: string, fromSequence: number) => Awaitable<void>;
}
