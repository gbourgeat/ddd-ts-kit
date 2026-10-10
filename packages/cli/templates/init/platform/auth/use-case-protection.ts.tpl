import {
  AuthorizationMap,
  AuthorizationSetupError,
  authorizationMiddleware,
  type Authorizer,
  type OnDecision,
  type UseCaseDeclaration,
} from '@ddd-ts-kit/auth';
import type { BusMiddleware } from '@ddd-ts-kit/kernel';

/**
 * The guard both buses ask before any handler. The buses exist before the contexts are wired,
 * so the declarations arrive afterwards; until then every message is refused.
 */
export class UseCaseProtection {
  private declared: BusMiddleware | undefined;

  constructor(
    private readonly authorizer: Authorizer,
    private readonly onDecision: OnDecision,
  ) {}

  readonly guard: BusMiddleware = (message, next, info) => {
    if (this.declared === undefined) {
      throw new AuthorizationSetupError('No use case was declared yet: call declare() once the contexts are wired');
    }

    return this.declared(message, next, info);
  };

  declare(useCases: readonly UseCaseDeclaration[]): void {
    this.declared = authorizationMiddleware({
      authorizer: this.authorizer,
      map: new AuthorizationMap(useCases),
      onDecision: this.onDecision,
    });
  }
}
