import type { AuditRow } from '@ddd-ts-kit/knex';

export interface DelegationColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly practice_id: string;
  readonly practitioner_id: string;
  readonly assistant_id: string;
  readonly availability_included: boolean;
  readonly ends_at: Date | null;
  readonly ended_at: Date | null;
  readonly end_cause: 'revoked' | 'expired' | 'member-removed' | null;
}

export interface DelegationRow extends DelegationColumns, AuditRow {
  readonly version: number;
}
