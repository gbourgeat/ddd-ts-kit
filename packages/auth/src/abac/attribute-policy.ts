import type { Grant } from '../permissions/grant.js';
import { grantPattern } from '../permissions/grant-pattern.js';
import type { Condition } from './condition.js';

export interface AttributePolicy {
  readonly name: string;
  readonly effect: 'permit' | 'forbid';
  readonly grants: readonly string[];
  readonly when: Condition;
}

/** Allows the permissions when the condition holds, unless a `forbid` policy applies. */
export function permit(name: string, permissions: readonly Grant[], when: Condition = () => true): AttributePolicy {
  return { name, effect: 'permit', grants: permissions.map(grantPattern), when };
}

/** Refuses the permissions when the condition holds, whatever the `permit` policies say. */
export function forbid(name: string, permissions: readonly Grant[], when: Condition = () => true): AttributePolicy {
  return { name, effect: 'forbid', grants: permissions.map(grantPattern), when };
}
