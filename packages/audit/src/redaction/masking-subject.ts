import type { AuditResource } from '@ddd-ts-kit/kernel';

/** What a masker may read to choose its key: identifiers of the entry being written. */
export interface MaskingSubject {
  readonly field: string;
  readonly actorId: string;
  readonly tenantId?: string;
  readonly resource?: AuditResource;
}
