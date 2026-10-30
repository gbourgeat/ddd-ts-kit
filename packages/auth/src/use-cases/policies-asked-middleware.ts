import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import { recordingAskedPermissions } from '../authorization/asked-permissions';
import { PolicyDenialIgnoredError } from '../errors/policy-denial-ignored-error';
import { PolicyNotAskedError } from '../errors/policy-not-asked-error';
import type { Permission } from '../permissions/permission';
import type { AuthorizationMap } from './authorization-map';

export interface PoliciesAskedMiddlewareOptions {
  readonly map: AuthorizationMap;
  /** The permissions some policy refines: their use cases have to ask `Access` once the element is loaded. */
  readonly refined: readonly Permission[];
}

/**
 * Refuses the result of a handler that never asked `Access` about the permission of its use case
 * when a policy refines it: the bus checked the permission without the element, and the rule of
 * the policy would be skipped. Refuses as well the result of a handler whose last question on that
 * permission was not allowed (denied, or failed and caught) and that answered with a success all the
 * same: a handler that stops on the denial with a failed `Result` (`err(...)`) or a throw is let
 * through with its own refusal. Install it with `aroundHandler` of the bus, inside the unit of
 * work, so that the refusal rolls the change back and a middleware that answers in place of the
 * handler is not judged. Only the questions put to `PolicyAccess` are seen.
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

    if (asked.get(declaration.permission.id) !== true && !isFailedResult(result)) {
      throw new PolicyDenialIgnoredError(info, declaration.permission.id);
    }

    return result;
  };
}

/** A `Result` of the kernel that failed (`err(...)`): the handler stopped with a refusal of its own. */
function isFailedResult(answer: unknown): boolean {
  return typeof answer === 'object' && answer !== null && Reflect.get(answer, 'ok') === false && 'error' in answer;
}
