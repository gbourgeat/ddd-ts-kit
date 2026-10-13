import type { AuditRow } from '@ddd-ts-kit/knex';

export interface OrganisationColumns {
  readonly id: string;
  readonly name: string;
  readonly opened_by: string;
  readonly opened_at: Date;
}

export interface OrganisationRow extends OrganisationColumns, AuditRow {
  readonly version: number;
}
