import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { fullEnvelope } from './full-envelope.js';

/** The full envelope of a fact that belongs to a tenant: what a transport of a multi-tenant project carries. */
export function tenantEnvelope(event: IntegrationEvent): IntegrationEvent {
  return { ...fullEnvelope(event), tenantId: 'tenant-7' };
}
