import type { AuditRow } from '@ddd-ts-kit/knex';
import type { AccountStatus } from '{{alias.context}}/domain/vocabularies/account-status.vocabulary{{alias.ext}}';

export interface AccountColumns {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
  readonly status: AccountStatus;
  readonly provisioned_at: Date;
  readonly deactivated_at: Date | null;
}

export interface AccountRow extends AccountColumns, AuditRow {
  readonly version: number;
}
