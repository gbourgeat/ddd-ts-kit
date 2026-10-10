import type { AuditStamp } from './audit-stamp.js';

/** The two columns an `UPDATE` statement sets, for an adapter that does not read the row first. */
export type UpdateStamp = Pick<AuditStamp, 'updatedAt' | 'updatedBy'>;
