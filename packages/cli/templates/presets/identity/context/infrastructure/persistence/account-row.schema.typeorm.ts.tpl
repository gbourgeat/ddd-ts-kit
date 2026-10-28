import type { AuditStamp } from '@ddd-ts-kit/kernel';
import type { AccountStatus } from '{{alias.context}}/domain/vocabularies/account-status.vocabulary{{alias.ext}}';

export interface AccountColumns {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  provisionedAt: Date;
  deactivatedAt: Date | null;
}

export interface AccountRow extends AccountColumns, AuditStamp {
  version: number;
}
