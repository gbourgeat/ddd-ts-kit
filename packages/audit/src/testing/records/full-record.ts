import type { AuditRecord } from '@ddd-ts-kit/kernel';
import { inTenant } from './in-tenant';

export function fullRecord(id: string): AuditRecord {
  return {
    ...inTenant(id, 'alpha'),
    outcome: 'failed',
    reason: 'APPOINTMENT_ALREADY_CANCELLED',
    impersonatedBy: 'support-7',
    sessionId: 'session-1',
    resource: { type: 'appointment', id: 'apt-1' },
    context: 'scheduling',
    causationId: 'request-1',
    changes: { status: 'cancelled', seats: 2, urgent: false, note: null, email: { masked: 'k1:9f2c' } },
    extensions: {},
  };
}
