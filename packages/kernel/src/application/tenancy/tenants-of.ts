import type { Actor } from '../actor/actor.js';

/**
 * The tenants an actor belongs to: its `tenantId`, and the `tenants` attribute for an actor
 * that belongs to several (a consultant of two clinics). The authenticator fills both from
 * the credential; nothing else may.
 */
export function tenantsOf(actor: Actor): readonly string[] {
  const listed: unknown = actor.attributes['tenants'];
  const others = isTextList(listed) ? listed : [];

  return [...new Set([...(actor.tenantId === undefined ? [] : [actor.tenantId]), ...others])];
}

function isTextList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
