import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import { recordingAskedPermissions } from '../authorization/asked-permissions.js';
import { PolicyNotAskedError } from '../errors/policy-not-asked-error.js';
import type { Permission } from '../permissions/permission.js';
import type { AuthorizationMap } from './authorization-map.js';

export interface PoliciesAskedMiddlewareOptions {
  readonly map: AuthorizationMap;
  /** The permissions some policy refines: their use cases have to ask `Access` once the element is loaded. */
  readonly refined: readonly Permission[];
}

/**
 * Refuses the result of a handler that never asked `Access` about the permission of its use case
 * when a policy refines it: the bus checked the permission without the element, and the rule of
 * the policy would be skipped. Install it last, inside the unit of work, so that the refusal
 * rolls the change back. Only the questions put to `PolicyAccess` are seen.
 */
export function policiesAskedMiddleware({ map, refined }: PoliciesAskedMiddlewareOptions): BusMiddleware {
  const ids = new Set(refined.map((permission) => permission.id));

  return async (message, next, info) => {
    const declaration = map.find(message);

    if (declaration?.access !== 'protected' || !ids.has(declaration.permission.id)) {
      return next();
    }

    const { result, asked } = await recordingAskedPermissions(next);

    if (!asked.has(declaration.permission.id)) {
      throw new PolicyNotAskedError(info, declaration.permission.id);
    }

    return result;
  };
}
