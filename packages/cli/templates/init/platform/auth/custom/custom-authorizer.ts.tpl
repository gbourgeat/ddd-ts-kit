import {
  ALLOWED,
  DenialReason,
  deny,
  Trace,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type Explanation,
  type ListRequest,
} from '@ddd-ts-kit/auth';
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

  async check(request: CheckRequest): Promise<Decision> {
    return (await this.explain(request)).decision;
  }

  /** Why: one line per role of the actor, saying whether it holds the permission. For debugging. */
  async explain({ actor, permission }: CheckRequest): Promise<Explanation> {
    const trace = new Trace();

    if (isAnonymous(actor)) {
      return { decision: deny(DenialReason.anonymous), trace: trace.lines };
    }

    const granted = actor.roles.map((role) => this.roleGrants(role, permission.id, trace)).includes(true);

    return { decision: granted ? ALLOWED : deny(notGranted), trace: trace.lines };
  }

  async listAccessible({ actor, permission }: ListRequest): Promise<AccessScope> {
    return !isAnonymous(actor) && this.granted(actor, permission.id) ? { kind: 'all' } : { kind: 'none' };
  }

  private roleGrants(role: string, permissionId: string, trace: Trace): boolean {
    return this.grants[role]?.includes(permissionId) === true
      ? trace.yes(`${role} grants ${permissionId}`)
      : trace.no(`${role} does not grant ${permissionId}`);
  }

  private granted(actor: Actor, permissionId: string): boolean {
    return actor.roles.some((role) => this.grants[role]?.includes(permissionId) === true);
  }
}
