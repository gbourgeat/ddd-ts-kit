import type { AuditChange } from './audit-change';

/** The declared fields of what was done, and nothing else. Absent by default. */
export type AuditChanges = Readonly<Record<string, AuditChange>>;
