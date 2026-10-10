import { isActored, isAnonymous, type BusMiddleware, type Message, type MessageInfo } from '@ddd-ts-kit/kernel';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { deny, type Decision } from '../authorization/decision.js';
import { decisionRecordOf } from '../authorization/decision-record-of.js';
import { DenialReason } from '../authorization/denial-reason.js';
import type { OnDecision } from '../authorization/on-decision.js';
import { ForbiddenError } from '../errors/forbidden-error.js';
import { MissingActorError } from '../errors/missing-actor-error.js';
import { UnauthenticatedError } from '../errors/unauthenticated-error.js';
import { UndeclaredUseCaseError } from '../errors/undeclared-use-case-error.js';
import type { AuthorizationMap } from './authorization-map.js';
import type { ProtectedUseCase } from './use-case-declaration.js';

export interface AuthorizationMiddlewareOptions {
  readonly authorizer: Authorizer;
  readonly map: AuthorizationMap;
  /** The audit hook: called once per protected message, whether allowed or refused. */
  readonly onDecision?: OnDecision;
}

/**
 * Asks the authorizer before any handler runs. Deny by default: a message the map does not
 * know is refused with `UndeclaredUseCaseError`. Install it before the unit of work, so a
 * refused command opens no transaction.
 */
export function authorizationMiddleware(options: AuthorizationMiddlewareOptions): BusMiddleware {
  return async (message, next, info) => {
    const declaration = options.map.find(message);

    if (declaration === undefined) {
      throw new UndeclaredUseCaseError(info);
    }

    if (declaration.access === 'protected') {
      await assertAllowed(options, declaration, { message, info });
    }

    return next();
  };
}

interface Sending {
  readonly message: Message;
  readonly info: MessageInfo;
}

async function assertAllowed(
  { authorizer, onDecision }: AuthorizationMiddlewareOptions,
  declaration: ProtectedUseCase,
  { message, info }: Sending,
): Promise<void> {
  const request = requestOf(declaration, message, info);
  const anonymous = isAnonymous(request.actor);
  const decision: Decision = anonymous ? deny(DenialReason.anonymous) : await authorizer.check(request);

  await onDecision?.(decisionRecordOf(request, decision, info));

  if (decision.allowed) {
    return;
  }

  throw anonymous ? new UnauthenticatedError() : new ForbiddenError(request.permission.id, decision.reason);
}

function requestOf(declaration: ProtectedUseCase, message: Message, info: MessageInfo): CheckRequest {
  if (!isActored(message)) {
    throw new MissingActorError(info);
  }

  const resource = declaration.resourceOf(message);
  const context = declaration.contextOf(message);

  return {
    actor: message.actor,
    permission: declaration.permission,
    ...(resource === undefined ? {} : { resource }),
    ...(context === undefined ? {} : { context }),
  };
}
