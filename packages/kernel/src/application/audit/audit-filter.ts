import type { AuditCategory } from './audit-category.js';
import type { AuditOutcome } from './audit-outcome.js';

export interface AuditFilter {
  readonly chain?: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  /** Every entry about one resource, or about every resource of a type when `id` is absent. */
  readonly resource?: { readonly type: string; readonly id?: string };
  readonly action?: string;
  readonly category?: AuditCategory;
  readonly outcome?: AuditOutcome;
  /** `occurredAt` at or after this instant. */
  readonly from?: Date;
  /** `occurredAt` strictly before this instant. */
  readonly to?: Date;
  readonly correlationId?: string;
  /** Positions of a chain, both included. Meant to be used with `chain`. */
  readonly fromSequence?: number;
  readonly toSequence?: number;
}
