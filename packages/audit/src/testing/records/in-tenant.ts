import type { AuditRecord } from '@ddd-ts-kit/kernel';
import { aRecord } from './a-record';

export function inTenant(id: string, tenantId: string): AuditRecord {
  return { ...aRecord(id), actor: { id: 'ada', type: 'user', tenantId }, tenantId };
}
