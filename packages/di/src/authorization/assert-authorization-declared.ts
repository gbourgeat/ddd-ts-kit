import { describeToken } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error.js';
import type { TokenSet } from '../token/token-set.js';
import type { MessageHandling } from '../wiring/message-handling.js';
import { whereOf } from '../wiring/where-of.js';
import type { Wiring } from '../wiring/wiring.js';
import { UseCaseGuard } from './use-case-guard.js';

/** Deny by default at wiring time: no use case becomes reachable because nobody said who may reach it. */
export function assertAuthorizationDeclared(wiring: Wiring, overridden: TokenSet): void {
  const undeclared = wiring.handlings.filter((handling) => handling.requirement.access === undefined);

  if (undeclared.length > 0) {
    const names = undeclared.map(({ kind, message, ...where }) => `the ${kind} "${message.name}" (${whereOf(where)})`);

    throw new WiringError(
      'UNDECLARED_AUTHORIZATION',
      `Authorization is required and ${names.join(', ')} declare${undeclared.length === 1 ? 's' : ''} no access. ${remedyFor(undeclared)}`,
    );
  }

  if (wiring.bindings.has(UseCaseGuard) || overridden.has(UseCaseGuard)) {
    return;
  }

  throw new WiringError(
    'AUTHORIZATION_NOT_ENFORCED',
    `Authorization is required but no module binds "${describeToken(UseCaseGuard)}": the declared permissions would never be checked. Add an authorization module to the modules.`,
  );
}

function remedyFor(undeclared: readonly MessageHandling[]): string {
  const remedies = [
    ...(undeclared.some(({ declaredBy }) => declaredBy === undefined)
      ? ['Write .requires(permission) or .public() before handledBy.']
      : []),
    ...(undeclared.some(({ declaredBy }) => declaredBy !== undefined)
      ? ['Decorate the message class with @Requires(permission) or @Public().']
      : []),
  ];

  return remedies.join(' ');
}
