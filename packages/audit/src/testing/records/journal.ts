import type { AuditRecord } from '@ddd-ts-kit/kernel';
import { inTenant } from './in-tenant.js';
import { later } from './later.js';

/** Four records over two tenants, a second apart: what the filters and the pages of the contract read. */
export const JOURNAL: readonly AuditRecord[] = [
  { ...inTenant('e-1', 'alpha'), occurredAt: later(0), resource: { type: 'appointment', id: 'apt-1' } },
  {
    ...inTenant('e-2', 'alpha'),
    occurredAt: later(1),
    actor: { id: 'grace', type: 'user', tenantId: 'alpha' },
    category: 'authorization',
    action: 'scheduling:appointment.read',
    outcome: 'allowed',
  },
  {
    ...inTenant('e-3', 'alpha'),
    occurredAt: later(2),
    category: 'authorization',
    action: 'scheduling:appointment.cancel',
    outcome: 'denied',
    reason: 'NO_MATCHING_ROLE',
    resource: { type: 'appointment', id: 'apt-2' },
    correlationId: 'correlation-2',
  },
  {
    ...inTenant('e-4', 'beta'),
    occurredAt: later(3),
    actor: { id: 'grace', type: 'user', tenantId: 'beta' },
    resource: { type: 'appointment', id: 'apt-1' },
    correlationId: 'correlation-2',
  },
];
