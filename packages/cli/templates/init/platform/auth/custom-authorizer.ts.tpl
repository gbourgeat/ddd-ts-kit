import { ALLOWED, DenialReason, deny, type AccessScope, type Authorizer, type CheckRequest, type Decision, type ListRequest } from '@ddd-ts-kit/auth';
import { isAnonymous, type Actor } from '@ddd-ts-kit/kernel';

const notGranted = 'NOT_GRANTED';

/**
 * The adapter of the `Authorizer` port for a model of your own, or for a service that decides
 * (OpenFGA, SpiceDB, a policy engine). This stub reads a table of permission ids by role, so
 * that the application runs; custom-authorizer.contract.spec.ts holds whatever replaces it to
 * what the middleware and the handlers rely on.
 */
// TODO(platform): replace the table by calls to your model, keeping the reasons as stable machine codes.
export class CustomAuthorizer implements Authorizer {
  constructor(private readonly grants: Readonly<Record<string, readonly string[]>>) {}

  async check({ actor, permission }: CheckRequest): Promise<Decision> {
    if (isAnonymous(actor)) return deny(DenialReason.anonymous);

    return this.granted(actor, permission.id) ? ALLOWED : deny(notGranted);
  }

  async listAccessible({ actor, permission }: ListRequest): Promise<AccessScope> {
    return !isAnonymous(actor) && this.granted(actor, permission.id) ? { kind: 'all' } : { kind: 'none' };
  }

  private granted(actor: Actor, permissionId: string): boolean {
    return actor.roles.some((role) => this.grants[role]?.includes(permissionId) === true);
  }
}
