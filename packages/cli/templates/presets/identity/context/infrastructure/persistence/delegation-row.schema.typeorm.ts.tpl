import type { AuditStamp } from '@ddd-ts-kit/kernel';

export interface DelegationColumns {
  id: string;
  organisationId: string;
  delegatorId: string;
  delegateId: string;
  /** The rights lent, separated by commas: a right is a word of `MemberRight`, which holds none. */
  rights: string;
  startsAt: Date;
  endsAt: Date;
  endedAt: Date | null;
}

export interface DelegationRow extends DelegationColumns, AuditStamp {
  version: number;
}
