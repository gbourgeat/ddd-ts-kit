import type { Actor } from '../actor/actor.js';
import { tenantsOf } from './tenants-of.js';

/** Whether the actor belongs to the tenant, as its credential says: `tenantId` or the `tenants` attribute. */
export function isTenantMember(actor: Actor, tenantId: string): boolean {
  return tenantsOf(actor).includes(tenantId);
}
