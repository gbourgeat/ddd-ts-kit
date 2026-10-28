import type { AuditStamp } from '@ddd-ts-kit/kernel';

export interface OrganisationColumns {
  id: string;
  name: string;
  openedBy: string;
  openedAt: Date;
}

export interface OrganisationRow extends OrganisationColumns, AuditStamp {
  version: number;
}
