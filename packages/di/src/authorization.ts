import type { ActorContext, BusMiddleware } from '@ddd-ts-kit/kernel';
import { WiringError } from './errors.js';
import type { Wiring } from './module.js';
import { describeToken, token, type Token } from './token.js';
import type { UseCaseDeclaration } from './use-case-access.js';

/** The actor of the request being processed, for infrastructure only: audit columns, tenant scoping. */
export const ACTOR_CONTEXT = token<ActorContext>('kernel.ActorContext');
/**
 * What the kernel buses run before anything else, the unit of work included. Unbound, every
 * message passes; an authorization module binds the middleware that asks its authorizer.
 */
export const USE_CASE_GUARD = token<BusMiddleware>('kernel.UseCaseGuard');
/** What every module declared about the access to its commands and queries, as data. */
export const USE_CASE_DECLARATIONS = token<readonly UseCaseDeclaration[]>('kernel.UseCaseDeclarations');

/** `required` refuses, when the application is created, a use case that declares no access. */
export type AuthorizationMode = 'optional' | 'required';

export const passEveryMessage: BusMiddleware = (_message, next) => next();

/** Resolved at each message, so the guard may be bound, rebound or faked after the bus exists. */
export function useCaseGuard(resolve: <T>(target: Token<T>) => T): BusMiddleware {
  return (message, next, info) => resolve(USE_CASE_GUARD)(message, next, info);
}

export function declarationsOf(wiring: Wiring): readonly UseCaseDeclaration[] {
  return wiring.handlings.map(({ kind, message, module, requirement }) => ({ kind, message, module, ...requirement }));
}

/** Deny by default at wiring time: no use case becomes reachable because nobody said who may reach it. */
export function assertAuthorizationDeclared(wiring: Wiring, overridden: ReadonlySet<Token<unknown>>): void {
  const undeclared = wiring.handlings.filter((handling) => handling.requirement.access === undefined);
  if (undeclared.length > 0) {
    const names = undeclared.map(({ kind, message, module }) => `the ${kind} "${message.name}" (module "${module}")`);
    throw new WiringError(
      'UNDECLARED_AUTHORIZATION',
      `Authorization is required and ${names.join(', ')} declare${undeclared.length === 1 ? 's' : ''} no access. Write .requires(permission) or .public() before handledBy.`,
    );
  }
  if (wiring.bindings.has(USE_CASE_GUARD) || overridden.has(USE_CASE_GUARD)) return;
  throw new WiringError(
    'AUTHORIZATION_NOT_ENFORCED',
    `Authorization is required but no module binds "${describeToken(USE_CASE_GUARD)}": the declared permissions would never be checked. Add an authorization module to the modules.`,
  );
}
