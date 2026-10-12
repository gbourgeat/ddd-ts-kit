import type { AuditRow } from '@ddd-ts-kit/knex';
import type { DelegationEndCause } from '@/contexts/identity/domain/vocabularies/delegation-end-cause.vocabulary';

export interface DelegationColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly practice_id: string;
  readonly practitioner_id: string;
  readonly assistant_id: string;
  readonly availability_included: boolean;
  readonly ends_at: Date | null;
  readonly ended_at: Date | null;
  readonly end_cause: DelegationEndCause | null;
}

export interface DelegationRow extends DelegationColumns, AuditRow {
  readonly version: number;
}
