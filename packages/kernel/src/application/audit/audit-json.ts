import type { AuditScalar } from './audit-scalar';

/** What an extension may hold: plain JSON, so that it is hashed and stored as it is. */
export type AuditJson = AuditScalar | readonly AuditJson[] | { readonly [key: string]: AuditJson };
