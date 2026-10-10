import { ForbiddenError } from '@ddd-ts-kit/auth';
import { isImpersonated, type BusMiddleware, type ExecutionScope } from '@ddd-ts-kit/kernel';

/** The reason of the refusal, as a client and the logs read it. */
const IMPERSONATION_READ_ONLY = 'IMPERSONATION_READ_ONLY';

/**
 * Support staff see what the user they impersonate sees, and change nothing: every command of
 * a session that carries `impersonatedBy` is refused, whatever the permissions of the user.
 * Queries stay allowed, since this is installed on the command bus only. The error names the
 * command where it expects a permission: no single permission is missing.
 */
export function readOnlyImpersonation(scope: ExecutionScope): BusMiddleware {
  return (_message, next, info) => {
    const session = scope.current()?.session;

    if (session !== undefined && isImpersonated(session)) return Promise.reject(new ForbiddenError(info.name, IMPERSONATION_READ_ONLY));

    return next();
  };
}
