import type { AuditResource } from '@ddd-ts-kit/kernel';

/** What a masker may read to choose its key: identifiers of the entry being written, and whose the value is. */
export interface MaskingSubject {
  readonly field: string;
  readonly actorId: string;
  readonly tenantId?: string;
  readonly resource?: AuditResource;
  /** The data subject the masked value belongs to, as `masked(field, { subject })` named it. */
  readonly dataSubject?: string;
}
