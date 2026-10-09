import { AuthorizationMap, AuthorizationSetupError, authorizationMiddleware, type Authorizer, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import { auditDecision } from './audit.js';

/**
 * The guard both buses ask before any handler. The buses exist before the contexts are wired,
 * so the declarations arrive afterwards; until then every message is refused.
 */
export class UseCaseProtection {
  #guard: BusMiddleware | undefined;

  constructor(private readonly authorizer: Authorizer) {}

  readonly guard: BusMiddleware = (message, next, info) => {
    if (this.#guard === undefined) throw new AuthorizationSetupError('No use case was declared yet: call declare() once the contexts are wired');
    return this.#guard(message, next, info);
  };

  declare(useCases: readonly UseCaseDeclaration[]): void {
    this.#guard = authorizationMiddleware({ authorizer: this.authorizer, map: new AuthorizationMap(useCases), onDecision: auditDecision });
  }
}
