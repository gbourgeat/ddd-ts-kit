/**
 * Platform staff reaching tenants that are not theirs: said, never implied. Opened by
 * `acrossTenants`, which records it in the audit trail before any work runs.
 */
export interface TenantElevation {
  /** A stable code naming why (`SUPPORT_TICKET`, `BILLING_RECONCILIATION`), never a sentence: it is audited. */
  readonly reason: string;
  /** The tenants the work may read: `all`, or the list. */
  readonly tenants: 'all' | readonly string[];
}
