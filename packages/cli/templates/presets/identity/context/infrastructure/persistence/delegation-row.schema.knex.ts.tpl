import type { AuditRow } from '@ddd-ts-kit/knex';

export interface DelegationColumns {
  readonly id: string;
  readonly organisation_id: string;
  readonly delegator_id: string;
  readonly delegate_id: string;
  /** The rights lent, separated by commas: a right is a word of `MemberRight`, which holds none. */
  readonly rights: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly ended_at: Date | null;
}

export interface DelegationRow extends DelegationColumns, AuditRow {
  readonly version: number;
}
