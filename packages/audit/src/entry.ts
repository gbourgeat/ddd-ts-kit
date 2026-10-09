import type { AuditRecord } from '@ddd-ts-kit/kernel';

export type {
  AuditActor,
  AuditCategory,
  AuditChange,
  AuditChanges,
  AuditEntry,
  AuditEntryExtensionValues,
  AuditEntryExtensions,
  AuditJson,
  AuditOutcome,
  AuditRecord,
  AuditResource,
  AuditScalar,
  MaskedValue,
} from '@ddd-ts-kit/kernel';

export const GLOBAL_CHAIN = 'global';

/**
 * One chain per tenant, and one `global` chain for work that names no tenant. A tenant can
 * then be verified, exported and handed over alone, and two tenants never wait for each other
 * to append. The price: the order of entries of different tenants is not proven by a chain.
 */
export function chainOfTenant(record: AuditRecord): string {
  return record.tenantId === undefined ? GLOBAL_CHAIN : `tenant:${record.tenantId}`;
}
